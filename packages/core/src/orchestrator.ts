import type { AuditPort, ContextPort, CoreResponse, InteractionRequest } from './contracts'
import { AiRouter } from './ai-router'
import { pegasusIdentity, type PegasusIdentity } from './identity'
import { assembleModelMessages } from './prompt-assembly'

export class PegasusCore {
  constructor(private readonly router: AiRouter, private readonly context: ContextPort, private readonly audit?: AuditPort, private readonly identity: PegasusIdentity = pegasusIdentity) {}

  async handle(request: InteractionRequest): Promise<CoreResponse> {
    const assembled = await this.context.assemble(request)
    const liveItems = (request.liveInformation ?? []).map((evidence) => ({
      source: `live:${evidence.capability}:${evidence.provider}`,
      classification: 'public' as const,
      kind: 'live_information' as const,
      trust: 'untrusted_external' as const,
      value: `${evidence.value}\nFreshness: observado em ${evidence.observedAt}; consultado em ${evidence.retrievedAt}${evidence.validUntil ? `; válido até ${evidence.validUntil}` : ''}. Fonte primária: ${evidence.sourceName} (${evidence.sourceUrl}).`,
      provenance: {
        sourceKind: 'live_information', sourceRef: evidence.sourceUrl,
        recordedAt: evidence.observedAt, updatedAt: evidence.retrievedAt,
        authority: evidence.sourceName, confidence: 1,
        sourceActorType: 'external_source' as const,
        sourceActorRelationshipToOwner: 'not_applicable' as const,
      },
    }))
    const snapshot = liveItems.length ? { ...assembled, items: [...assembled.items, ...liveItems] } : assembled
    const messages = assembleModelMessages(request, snapshot, this.identity)
    const result = await this.router.route(request, messages)
    await this.audit?.record({ correlationId: request.correlationId, type: 'core.response.created', metadata: { provider: result.provider, model: result.model, fallback: result.fallbackUsed, trust: result.trust } })
    return { requestId: request.id, correlationId: request.correlationId, content: result.content, modelOutputTrust: 'untrusted', executionAuthorization: 'none', route: { provider: result.provider, model: result.model, usage: result.usage, estimatedCostUsd: result.estimatedCostUsd, latencyMs: result.latencyMs, fallbackUsed: result.fallbackUsed } }
  }
}
