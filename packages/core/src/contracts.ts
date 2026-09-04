export type Modality = 'text' | 'image' | 'audio'
export type Capability = 'fast' | 'balanced' | 'reasoning' | 'deep-reasoning' | 'multimodal' | 'voice'
export type Quality = 'economy' | 'standard' | 'high'
export type LatencyPreference = 'low' | 'normal' | 'relaxed'
export type ModelOutputTrust = 'untrusted'

export type InteractionInput = {
  modality: Modality
  content: string
  attachments?: readonly { id: string; mediaType: string }[]
}

export type InteractionRequest = {
  id: string
  correlationId: string
  actorId: string
  conversationId?: string
  input: InteractionInput
  requirements: {
    capability: Capability
    quality?: Quality
    latency?: LatencyPreference
    requiredModalities?: readonly Modality[]
  }
  execution?: {
    timeoutMs?: number
    allowPaidModels?: boolean
    maxEstimatedCostUsd?: number
    signal?: AbortSignal
  }
}

export type ContextSnapshot = {
  id: string
  items: readonly { source: string; classification: 'public' | 'internal' | 'confidential'; value: string }[]
}

export type ModelMessage = { role: 'system' | 'user' | 'assistant'; content: string }
export type ProviderRequest = {
  requestId: string
  correlationId: string
  model: string
  messages: readonly ModelMessage[]
  modality: Modality
  signal: AbortSignal
}

export type Usage = {
  inputUnits?: number
  outputUnits?: number
  totalUnits?: number
  unit: 'tokens' | 'characters' | 'seconds' | 'images' | 'unknown'
}

export type ProviderResponse = {
  content: string
  finishReason: 'completed' | 'length' | 'cancelled' | 'filtered' | 'unknown'
  usage?: Usage
}

export type ProviderStreamEvent =
  | { type: 'delta'; value: string }
  | { type: 'usage'; value: Usage }
  | { type: 'done'; finishReason: ProviderResponse['finishReason'] }

export interface AiProviderAdapter {
  readonly id: string
  isAvailable(): boolean | Promise<boolean>
  generate(request: ProviderRequest): Promise<ProviderResponse>
  stream?(request: ProviderRequest): AsyncIterable<ProviderStreamEvent>
}

export type ModelDescriptor = {
  provider: string
  model: string
  enabled: boolean
  capabilities: readonly Capability[]
  modalities: readonly Modality[]
  quality: number
  latency: number
  priority: number
  requiresCredential: boolean
  pricing?: { inputPerMillionUnits: number; outputPerMillionUnits: number }
}

export type RouterConfig = {
  models: readonly ModelDescriptor[]
  timeoutMs: number
  retriesPerModel: number
  fallback: { enabled: boolean; maxModels: number; allowPaid: boolean }
}

export type SanitizedRouterError = {
  code: 'provider_unavailable' | 'timeout' | 'cancelled' | 'provider_error' | 'no_eligible_model' | 'configuration_error'
  retryable: boolean
}

export type RouterTrace = {
  correlationId: string
  durationMs: number
  provider?: string
  model?: string
  status: 'completed' | 'failed' | 'cancelled'
  usage?: Usage
  estimatedCostUsd?: number
  fallback: boolean
  attempt: number
  error?: SanitizedRouterError
}

export interface RouterObserver { record(trace: RouterTrace): void | Promise<void> }
export interface ContextPort { assemble(request: InteractionRequest): Promise<ContextSnapshot> }
export interface MemoryPort { retrieve(request: InteractionRequest): Promise<readonly string[]> }
export interface PermissionPort { check(input: { actorId: string; capability: string }): Promise<'allow' | 'deny' | 'approval_required'> }
export interface PolicyPort { evaluate(input: { actorId: string; intent: string }): Promise<'allow' | 'deny' | 'guard_required'> }
export interface DecisionGuardPort { evaluate(input: { actorId: string; intent: string }): Promise<'proceed' | 'caution' | 'reject' | 'unknown'> }
export interface ApprovalPort { request(input: { actorId: string; action: string }): Promise<{ id: string; status: 'pending' | 'approved' | 'rejected' }> }
export interface ToolPort { describe(): readonly { name: string; risk: string }[] }
export interface SkillPort { describe(): readonly { name: string; requiredTools: readonly string[] }[] }
export interface TaskPort { create(input: { objective: string; actorId: string }): Promise<{ id: string }> }
export interface DevicePort { capabilities(deviceId: string): Promise<readonly string[]> }
export interface IntegrationPort { capabilities(integrationId: string): Promise<readonly string[]> }
export interface VoicePort { capabilities(): Promise<readonly string[]> }
export interface AuditPort { record(event: { correlationId: string; type: string; metadata: Record<string, unknown> }): Promise<void> }

export type RouterResult = {
  content: string
  trust: ModelOutputTrust
  provider: string
  model: string
  usage?: Usage
  estimatedCostUsd?: number
  latencyMs: number
  fallbackUsed: boolean
}

export type CoreResponse = {
  requestId: string
  correlationId: string
  content: string
  modelOutputTrust: ModelOutputTrust
  executionAuthorization: 'none'
  route: Omit<RouterResult, 'content' | 'trust'>
}
