import type { AuditPort, InteractionRequest, LiveInformationEvidence } from './contracts'

export type CapabilityCategory = 'live_information' | 'knowledge' | 'device' | 'action'
export type CapabilityJsonSchema = Readonly<Record<string, unknown>>

export type CapabilityDescriptor = {
  id: string
  description: string
  category: CapabilityCategory
  inputSchema: CapabilityJsonSchema
  outputSchema: CapabilityJsonSchema
  provider: string
  freshnessTtlMs?: number
  readOnly: boolean
  approval: 'none' | 'required'
  audit: { eventPrefix: string }
}

export type CapabilitySelection =
  | { status: 'none' }
  | { status: 'needs_input'; capabilityId: string; intent: string; knownParameters: Record<string, unknown>; missingParameters: string[]; message: string }
  | { status: 'selected'; capabilityId: string; input: unknown }

export type PendingCapabilityInteraction = {
  conversationId: string
  capabilityId: string
  intent: string
  knownParameters: Record<string, unknown>
  missingParameters: string[]
  createdAt: string
  updatedAt: string
  expiresAt: string
  status: 'pending'
  correlationId: string
}

export type ConversationWorkingContext = {
  recentTurns: readonly { role: 'user' | 'assistant'; content: string; createdAt: string }[]
  pending?: PendingCapabilityInteraction
  activeCapability?: { capabilityId: string; intent: string; knownParameters: Record<string, unknown>; updatedAt: string }
}

export interface CapabilitySelectorPort {
  select(input: { request: InteractionRequest; capabilities: readonly CapabilityDescriptor[]; workingContext?: ConversationWorkingContext }): Promise<CapabilitySelection>
}

export interface CapabilityProviderPort {
  readonly id: string
  health(): Promise<'available' | 'unavailable'>
  execute(input: unknown, context: { correlationId: string; signal?: AbortSignal }): Promise<readonly LiveInformationEvidence[]>
}

export type CapabilityRouteResult =
  | { status: 'not_applicable' }
  | { status: 'needs_input'; message: string; pending: PendingCapabilityInteraction }
  | { status: 'unavailable'; message: string }
  | { status: 'available'; capability: CapabilityDescriptor; evidence: readonly LiveInformationEvidence[]; resolvedInput: Record<string, unknown> }

export class CapabilityInputError extends Error {
  constructor(public readonly safeMessage: string) { super('CAPABILITY_INPUT_REJECTED'); this.name = 'CapabilityInputError' }
}

type RegisteredCapability = {
  descriptor: CapabilityDescriptor
  provider: CapabilityProviderPort
  validateInput(input: unknown): boolean
  validateOutput(output: readonly LiveInformationEvidence[]): boolean
}

export class CapabilityRegistry {
  private readonly entries = new Map<string, RegisteredCapability>()

  register(entry: RegisteredCapability) {
    if (this.entries.has(entry.descriptor.id)) throw new Error('CAPABILITY_ALREADY_REGISTERED')
    if (entry.descriptor.provider !== entry.provider.id) throw new Error('CAPABILITY_PROVIDER_MISMATCH')
    this.entries.set(entry.descriptor.id, entry)
    return this
  }

  list() { return [...this.entries.values()].map((entry) => entry.descriptor) }
  get(id: string) { return this.entries.get(id) }
}

export class CapabilityRouter {
  constructor(private readonly registry: CapabilityRegistry, private readonly selector: CapabilitySelectorPort, private readonly audit?: AuditPort, private readonly now: () => Date = () => new Date()) {}

  async route(request: InteractionRequest, workingContext?: ConversationWorkingContext): Promise<CapabilityRouteResult> {
    const descriptors = this.registry.list()
    if (!descriptors.length) return { status: 'not_applicable' }
    let selection: CapabilitySelection
    try {
      selection = await this.selector.select({ request, capabilities: descriptors, workingContext })
    } catch {
      await this.record(request, 'capability.selection.failed', { reason: 'selector_unavailable' })
      return { status: 'unavailable', message: 'Não consegui verificar com segurança se esta solicitação precisa de informação externa atual. Não vou completar a resposta por suposição.' }
    }
    if (selection.status === 'none') return { status: 'not_applicable' }
    const entry = this.registry.get(selection.capabilityId)
    if (!entry) {
      await this.record(request, 'capability.selection.rejected', { reason: 'unknown_capability' })
      return { status: 'unavailable', message: 'A capability necessária não está disponível de forma confiável agora.' }
    }
    if (!entry.descriptor.readOnly || entry.descriptor.approval !== 'none' || entry.descriptor.category !== 'live_information') {
      await this.record(request, `${entry.descriptor.audit.eventPrefix}.rejected`, { capabilityId: entry.descriptor.id, reason: 'authority_boundary' })
      return { status: 'unavailable', message: 'A solicitação exige uma capability que não está autorizada neste checkpoint.' }
    }
    if (selection.status === 'needs_input') {
      await this.record(request, `${entry.descriptor.audit.eventPrefix}.needs_input`, { capabilityId: entry.descriptor.id })
      return { status: 'needs_input', message: selection.message, pending: this.pending(request, entry.descriptor.id, selection.intent, selection.knownParameters, selection.missingParameters, workingContext) }
    }
    if (!entry.validateInput(selection.input)) {
      await this.record(request, `${entry.descriptor.audit.eventPrefix}.rejected`, { capabilityId: entry.descriptor.id, reason: 'invalid_input' })
      const known = selection.input && typeof selection.input === 'object' ? selection.input as Record<string, unknown> : {}
      const required = Array.isArray(entry.descriptor.inputSchema.required) ? entry.descriptor.inputSchema.required.filter((item): item is string => typeof item === 'string') : []
      return { status: 'needs_input', message: 'Preciso dos parâmetros que faltam para consultar essa informação.', pending: this.pending(request, entry.descriptor.id, 'completar solicitação de informação atual', known, required.filter((key) => !(key in known)), workingContext) }
    }
    if (await entry.provider.health() !== 'available') {
      await this.record(request, `${entry.descriptor.audit.eventPrefix}.failed`, { capabilityId: entry.descriptor.id, reason: 'provider_unavailable' })
      return { status: 'unavailable', message: 'A fonte externa necessária não está disponível agora. Não vou estimar nem inventar dados.' }
    }
    await this.record(request, `${entry.descriptor.audit.eventPrefix}.selected`, { capabilityId: entry.descriptor.id, provider: entry.descriptor.provider, readOnly: true })
    try {
      const evidence = await entry.provider.execute(selection.input, { correlationId: request.correlationId, signal: request.execution?.signal })
      const stale = evidence.some((item) => item.validUntil && Date.parse(item.validUntil) <= this.now().getTime())
      if (!entry.validateOutput(evidence) || stale) {
        await this.record(request, `${entry.descriptor.audit.eventPrefix}.rejected`, { capabilityId: entry.descriptor.id, reason: stale ? 'stale_output' : 'invalid_output' })
        return { status: 'unavailable', message: 'A fonte retornou dados ausentes, inválidos ou expirados. Não vou utilizá-los na resposta.' }
      }
      await this.record(request, `${entry.descriptor.audit.eventPrefix}.completed`, { capabilityId: entry.descriptor.id, provider: entry.descriptor.provider, evidenceCount: evidence.length })
      return { status: 'available', capability: entry.descriptor, evidence, resolvedInput: selection.input as Record<string, unknown> }
    } catch (error) {
      if (error instanceof CapabilityInputError) {
        await this.record(request, `${entry.descriptor.audit.eventPrefix}.needs_input`, { capabilityId: entry.descriptor.id, reason: 'provider_input_rejected' })
        return { status: 'needs_input', message: error.safeMessage, pending: this.pending(request, entry.descriptor.id, 'esclarecer parâmetros da consulta', selection.input as Record<string, unknown>, ['clarification'], workingContext) }
      }
      await this.record(request, `${entry.descriptor.audit.eventPrefix}.failed`, { capabilityId: entry.descriptor.id, reason: 'provider_error' })
      return { status: 'unavailable', message: 'A fonte externa não respondeu de forma confiável agora. Não vou estimar nem inventar dados; tente novamente em alguns minutos.' }
    }
  }

  private async record(request: InteractionRequest, type: string, metadata: Record<string, unknown>) {
    await this.audit?.record({ correlationId: request.correlationId, type, metadata })
  }

  private pending(request: InteractionRequest, capabilityId: string, intent: string, knownParameters: Record<string, unknown>, missingParameters: string[], workingContext?: ConversationWorkingContext): PendingCapabilityInteraction {
    const timestamp = this.now().toISOString()
    return { conversationId: request.conversationId ?? '', capabilityId, intent, knownParameters, missingParameters, createdAt: workingContext?.pending?.createdAt ?? timestamp, updatedAt: timestamp, expiresAt: new Date(this.now().getTime() + 30 * 60_000).toISOString(), status: 'pending', correlationId: request.correlationId }
  }
}
