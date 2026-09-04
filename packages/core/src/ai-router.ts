import type { AiProviderAdapter, InteractionRequest, ModelDescriptor, ProviderRequest, RouterConfig, RouterObserver, RouterResult, RouterTrace, SanitizedRouterError, Usage } from './contracts'

export class AiRouterError extends Error {
  constructor(public readonly detail: SanitizedRouterError) {
    super(detail.code)
    this.name = 'AiRouterError'
  }
}

const qualityScore = { economy: 1, standard: 3, high: 5 } as const
const latencyScore = { low: 1, normal: 3, relaxed: 5 } as const

function isPaid(model: ModelDescriptor): boolean {
  return Boolean(model.pricing && (model.pricing.inputPerMillionUnits > 0 || model.pricing.outputPerMillionUnits > 0))
}

function supports(model: ModelDescriptor, request: InteractionRequest): boolean {
  const requiredModalities = request.requirements.requiredModalities ?? [request.input.modality]
  return model.enabled && model.capabilities.includes(request.requirements.capability) && requiredModalities.every((item) => model.modalities.includes(item))
    && model.quality >= qualityScore[request.requirements.quality ?? 'standard']
    && model.latency <= latencyScore[request.requirements.latency ?? 'relaxed']
}

export function rankModels(config: RouterConfig, request: InteractionRequest): ModelDescriptor[] {
  const allowPaid = request.execution?.allowPaidModels === true
  return config.models.filter((model) => supports(model, request) && (!isPaid(model) || allowPaid))
    .sort((left, right) => left.priority - right.priority || left.latency - right.latency || right.quality - left.quality || `${left.provider}/${left.model}`.localeCompare(`${right.provider}/${right.model}`))
}

export function estimateCost(usage: Usage | undefined, model: ModelDescriptor): number | undefined {
  if (!usage || !model.pricing || usage.unit !== 'tokens') return undefined
  const input = usage.inputUnits ?? 0
  const output = usage.outputUnits ?? 0
  return (input * model.pricing.inputPerMillionUnits + output * model.pricing.outputPerMillionUnits) / 1_000_000
}

function sanitizeError(error: unknown): SanitizedRouterError {
  if (error instanceof AiRouterError) return error.detail
  if (error instanceof DOMException && error.name === 'TimeoutError') return { code: 'timeout', retryable: true }
  if (error instanceof DOMException && error.name === 'AbortError') return { code: 'cancelled', retryable: false }
  return { code: 'provider_error', retryable: true }
}

function combinedSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  return signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs)
}

export class AiRouter {
  private readonly adapters = new Map<string, AiProviderAdapter>()

  constructor(private readonly config: RouterConfig, adapters: readonly AiProviderAdapter[], private readonly observer: RouterObserver) {
    for (const adapter of adapters) this.adapters.set(adapter.id, adapter)
  }

  async route(request: InteractionRequest, messages: ProviderRequest['messages']): Promise<RouterResult> {
    const ranked = rankModels(this.config, request)
    if (ranked.length === 0) throw new AiRouterError({ code: 'no_eligible_model', retryable: false })
    const maxModels = this.config.fallback.enabled ? Math.max(1, this.config.fallback.maxModels) : 1
    const candidates = ranked.filter((model, index) => index === 0 || (this.config.fallback.allowPaid || !isPaid(model))).slice(0, maxModels)
    let lastError: SanitizedRouterError = { code: 'provider_error', retryable: true }
    let attempt = 0

    for (const [modelIndex, model] of candidates.entries()) {
      const adapter = this.adapters.get(model.provider)
      if (!adapter || !(await adapter.isAvailable())) {
        attempt += 1
        lastError = { code: 'provider_unavailable', retryable: true }
        await this.trace(request, model, 0, attempt, modelIndex > 0, 'failed', undefined, undefined, lastError)
        continue
      }
      for (let retry = 0; retry <= this.config.retriesPerModel; retry += 1) {
        attempt += 1
        const started = Date.now()
        try {
          const response = await adapter.generate({ requestId: request.id, correlationId: request.correlationId, model: model.model, messages, modality: request.input.modality, signal: combinedSignal(request.execution?.signal, request.execution?.timeoutMs ?? this.config.timeoutMs) })
          const durationMs = Date.now() - started
          const estimatedCostUsd = estimateCost(response.usage, model)
          if (request.execution?.maxEstimatedCostUsd !== undefined && estimatedCostUsd !== undefined && estimatedCostUsd > request.execution.maxEstimatedCostUsd) {
            throw new AiRouterError({ code: 'configuration_error', retryable: false })
          }
          await this.trace(request, model, durationMs, attempt, modelIndex > 0, 'completed', response.usage, estimatedCostUsd)
          return { content: response.content, trust: 'untrusted', provider: model.provider, model: model.model, usage: response.usage, estimatedCostUsd, latencyMs: durationMs, fallbackUsed: modelIndex > 0 }
        } catch (error) {
          const durationMs = Date.now() - started
          lastError = sanitizeError(error)
          await this.trace(request, model, durationMs, attempt, modelIndex > 0, lastError.code === 'cancelled' ? 'cancelled' : 'failed', undefined, undefined, lastError)
          if (!lastError.retryable) throw new AiRouterError(lastError)
        }
      }
    }
    throw new AiRouterError(lastError)
  }

  private async trace(request: InteractionRequest, model: ModelDescriptor, durationMs: number, attempt: number, fallback: boolean, status: RouterTrace['status'], usage?: Usage, estimatedCostUsd?: number, error?: SanitizedRouterError) {
    const trace: RouterTrace = { correlationId: request.correlationId, durationMs, provider: model.provider, model: model.model, status, usage, estimatedCostUsd, fallback, attempt, error }
    await this.observer.record(trace)
  }
}
