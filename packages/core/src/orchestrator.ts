import type { AuditPort, ContextPort, CoreResponse, InteractionRequest } from './contracts'
import { AiRouter } from './ai-router'
import { pegasusIdentity, type PegasusIdentity } from './identity'
import { assembleModelMessages } from './prompt-assembly'

export class PegasusCore {
  constructor(private readonly router: AiRouter, private readonly context: ContextPort, private readonly audit?: AuditPort, private readonly identity: PegasusIdentity = pegasusIdentity) {}

  async handle(request: InteractionRequest): Promise<CoreResponse> {
    const snapshot = await this.context.assemble(request)
    const messages = assembleModelMessages(request, snapshot, this.identity)
    const result = await this.router.route(request, messages)
    await this.audit?.record({ correlationId: request.correlationId, type: 'core.response.created', metadata: { provider: result.provider, model: result.model, fallback: result.fallbackUsed, trust: result.trust } })
    return { requestId: request.id, correlationId: request.correlationId, content: result.content, modelOutputTrust: 'untrusted', executionAuthorization: 'none', route: { provider: result.provider, model: result.model, usage: result.usage, estimatedCostUsd: result.estimatedCostUsd, latencyMs: result.latencyMs, fallbackUsed: result.fallbackUsed } }
  }
}
