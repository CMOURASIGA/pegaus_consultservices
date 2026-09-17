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
  | { status: 'needs_input'; capabilityId: string; message: string }
  | { status: 'selected'; capabilityId: string; input: unknown }

export interface CapabilitySelectorPort {
  select(input: { request: InteractionRequest; capabilities: readonly CapabilityDescriptor[] }): Promise<CapabilitySelection>
}

export interface CapabilityProviderPort {
  readonly id: string
  health(): Promise<'available' | 'unavailable'>
  execute(input: unknown, context: { correlationId: string; signal?: AbortSignal }): Promise<readonly LiveInformationEvidence[]>
}

export type CapabilityRouteResult =
  | { status: 'not_applicable' }
  | { status: 'needs_input'; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'available'; capability: CapabilityDescriptor; evidence: readonly LiveInformationEvidence[] }

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

  async route(request: InteractionRequest): Promise<CapabilityRouteResult> {
    const descriptors = this.registry.list()
    if (!descriptors.length) return { status: 'not_applicable' }
    let selection: CapabilitySelection
    try {
      selection = await this.selector.select({ request, capabilities: descriptors })
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
      return { status: 'needs_input', message: selection.message }
    }
    if (!entry.validateInput(selection.input)) {
      await this.record(request, `${entry.descriptor.audit.eventPrefix}.rejected`, { capabilityId: entry.descriptor.id, reason: 'invalid_input' })
      return { status: 'needs_input', message: 'Preciso de uma localidade explícita e de um período válido para consultar essa informação.' }
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
      return { status: 'available', capability: entry.descriptor, evidence }
    } catch (error) {
      if (error instanceof CapabilityInputError) {
        await this.record(request, `${entry.descriptor.audit.eventPrefix}.needs_input`, { capabilityId: entry.descriptor.id, reason: 'provider_input_rejected' })
        return { status: 'needs_input', message: error.safeMessage }
      }
      await this.record(request, `${entry.descriptor.audit.eventPrefix}.failed`, { capabilityId: entry.descriptor.id, reason: 'provider_error' })
      return { status: 'unavailable', message: 'A fonte externa não respondeu de forma confiável agora. Não vou estimar nem inventar dados; tente novamente em alguns minutos.' }
    }
  }

  private async record(request: InteractionRequest, type: string, metadata: Record<string, unknown>) {
    await this.audit?.record({ correlationId: request.correlationId, type, metadata })
  }
}
