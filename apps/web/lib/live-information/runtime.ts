import 'server-only'

import { AiRouter, CapabilityRegistry, CapabilityRouter, FakeAiProvider, ModelCapabilitySelector, OpenAiProvider } from '@pegasus/core'
import type { AuditPort, CapabilitySelectorPort, RouterConfig, RouterObserver } from '@pegasus/core'
import { readServerConfig } from '@pegasus/config'
import { logger } from '@pegasus/logging'
import { isWeatherEvidence, isWeatherInput, OpenMeteoWeatherProvider, weatherCapability } from './weather'

export function createCapabilityRouting(options: { selector?: CapabilitySelectorPort; weatherProvider?: OpenMeteoWeatherProvider; audit?: AuditPort } = {}) {
  const config = readServerConfig()
  const observer: RouterObserver = { record(trace) { logger.info('capability.ai_route', { correlationId: trace.correlationId, status: trace.status, provider: trace.provider, model: trace.model, durationMs: trace.durationMs, error: trace.error }) } }
  const model = config.PEGASUS_AI_PROVIDER === 'openai'
    ? { provider: 'openai', model: config.PEGASUS_AI_MODEL, enabled: true, capabilities: ['balanced'] as const, modalities: ['text'] as const, quality: 3, latency: 1, priority: 1, requiresCredential: true, pricing: { inputPerMillionUnits: 0.2, outputPerMillionUnits: 1.2 } }
    : { provider: 'pegasus-fake', model: 'local-safe-v1', enabled: true, capabilities: ['balanced'] as const, modalities: ['text'] as const, quality: 3, latency: 1, priority: 1, requiresCredential: false }
  const routerConfig: RouterConfig = { models: [model], timeoutMs: Math.min(config.AI_ROUTER_TIMEOUT_MS, 10_000), retriesPerModel: 0, fallback: { enabled: false, maxModels: 1, allowPaid: false } }
  const adapter = config.PEGASUS_AI_PROVIDER === 'openai' ? new OpenAiProvider(config.OPENAI_API_KEY, 240) : new FakeAiProvider('pegasus-fake', { type: 'success', content: '{"status":"none"}' })
  const selector = options.selector ?? new ModelCapabilitySelector(new AiRouter(routerConfig, [adapter], observer), config.PEGASUS_AI_PROVIDER === 'openai')
  const registry = new CapabilityRegistry().register({ descriptor: weatherCapability, provider: options.weatherProvider ?? new OpenMeteoWeatherProvider(), validateInput: isWeatherInput, validateOutput: isWeatherEvidence })
  const audit = options.audit ?? { async record(event) { logger.info(event.type, { correlationId: event.correlationId, ...event.metadata }) } }
  return new CapabilityRouter(registry, selector, audit)
}
