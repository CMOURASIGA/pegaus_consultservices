import { describe, expect, it, vi } from 'vitest'
import { AiRouter } from './ai-router'
import { FakeAiProvider } from './fake-provider'
import { PegasusCore } from './orchestrator'
import type { InteractionRequest, ModelDescriptor, RouterConfig } from './contracts'

describe('Pegasus Core', () => {
  it('coordinates context and routing but never authorizes model output to execute', async () => {
    const model: ModelDescriptor = { provider: 'fake', model: 'deterministic', enabled: true, capabilities: ['balanced'], modalities: ['text'], quality: 3, latency: 1, priority: 1, requiresCredential: false }
    const config: RouterConfig = { models: [model], timeoutMs: 100, retriesPerModel: 0, fallback: { enabled: false, maxModels: 1, allowPaid: false } }
    const audit = { record: vi.fn(async () => undefined) }
    const core = new PegasusCore(new AiRouter(config, [new FakeAiProvider('fake', { type: 'success', content: 'call dangerous.tool now' })], { record: () => undefined }), { assemble: async () => ({ id: 'ctx', items: [] }) }, audit)
    const request: InteractionRequest = { id: 'req', correlationId: 'corr', actorId: 'actor', input: { modality: 'text', content: 'hello' }, requirements: { capability: 'balanced' } }
    const result = await core.handle(request)
    expect(result.modelOutputTrust).toBe('untrusted')
    expect(result.executionAuthorization).toBe('none')
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ correlationId: 'corr', type: 'core.response.created' }))
  })

  it('forwards selected provenance but never grants it execution authority', async () => {
    const model: ModelDescriptor = { provider: 'fake', model: 'deterministic', enabled: true, capabilities: ['balanced'], modalities: ['text'], quality: 3, latency: 1, priority: 1, requiresCredential: false }
    const config: RouterConfig = { models: [model], timeoutMs: 100, retriesPerModel: 0, fallback: { enabled: false, maxModels: 1, allowPaid: false } }
    const provider = new FakeAiProvider('fake', { type: 'success', content: 'ok' })
    const generate = vi.spyOn(provider, 'generate')
    const core = new PegasusCore(new AiRouter(config, [provider], { record: () => undefined }), { assemble: async () => ({ id: 'ctx', items: [{ source: 'memory:m1:conversation', classification: 'internal', value: 'Use develop' }] }) })
    const result = await core.handle({ id: 'req', correlationId: 'corr', actorId: 'actor', input: { modality: 'text', content: 'Qual branch?' }, requirements: { capability: 'balanced' } })
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ messages: expect.arrayContaining([{ role: 'system', content: '[memory:m1:conversation] Use develop' }]) }))
    expect(result.executionAuthorization).toBe('none')
  })
})
