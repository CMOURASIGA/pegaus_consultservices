import { describe, expect, it } from 'vitest'
import { AiRouter, AiRouterError, estimateCost, rankModels } from './ai-router'
import { FakeAiProvider } from './fake-provider'
import type { InteractionRequest, ModelDescriptor, RouterConfig, RouterTrace } from './contracts'

const freeFast: ModelDescriptor = { provider: 'fake-a', model: 'fast-v1', enabled: true, capabilities: ['fast', 'balanced'], modalities: ['text'], quality: 3, latency: 1, priority: 1, requiresCredential: false }
const freeReasoning: ModelDescriptor = { provider: 'fake-b', model: 'reason-v1', enabled: true, capabilities: ['reasoning'], modalities: ['text'], quality: 5, latency: 3, priority: 2, requiresCredential: false }
const paidFast: ModelDescriptor = { ...freeFast, provider: 'paid', model: 'paid-v1', priority: 0, requiresCredential: true, pricing: { inputPerMillionUnits: 2, outputPerMillionUnits: 4 } }
const config = (models: ModelDescriptor[], changes: Partial<RouterConfig> = {}): RouterConfig => ({ models, timeoutMs: 25, retriesPerModel: 0, fallback: { enabled: true, maxModels: 2, allowPaid: false }, ...changes })
const request = (changes: Partial<InteractionRequest> = {}): InteractionRequest => ({ id: 'req-1', correlationId: 'corr-1', actorId: 'actor-1', input: { modality: 'text', content: 'sensitive user content' }, requirements: { capability: 'fast', quality: 'standard', latency: 'low' }, ...changes })
const noOpObserver = { record: () => undefined }

describe('AI Router', () => {
  it('selects by capability instead of a provider name', () => {
    expect(rankModels(config([freeReasoning, freeFast]), request()).map((item) => item.model)).toEqual(['fast-v1'])
  })

  it('does not select a paid model without explicit request permission', () => {
    expect(rankModels(config([paidFast, freeFast]), request()).map((item) => item.provider)).toEqual(['fake-a'])
  })

  it('uses independent adapters deterministically and records usage/cost metadata', async () => {
    const traces: RouterTrace[] = []
    const provider = new FakeAiProvider('paid', { type: 'success', content: 'ok', usage: { inputUnits: 1000, outputUnits: 500, totalUnits: 1500, unit: 'tokens' } })
    const router = new AiRouter(config([paidFast]), [provider], { record: (trace) => { traces.push(trace) } })
    const result = await router.route(request({ execution: { allowPaidModels: true } }), [{ role: 'user', content: 'private' }])
    expect(result.provider).toBe('paid')
    expect(result.estimatedCostUsd).toBe(0.004)
    expect(result.trust).toBe('untrusted')
    expect(traces[0]).not.toHaveProperty('content')
    expect(JSON.stringify(traces[0])).not.toContain('private')
  })

  it('falls back only when explicitly enabled and marks the trace', async () => {
    const traces: RouterTrace[] = []
    const first = new FakeAiProvider('fake-a', { type: 'error' })
    const secondModel = { ...freeFast, provider: 'fake-b', model: 'fast-b', priority: 2 }
    const second = new FakeAiProvider('fake-b', { type: 'success', content: 'fallback' })
    const router = new AiRouter(config([freeFast, secondModel]), [first, second], { record: (trace) => { traces.push(trace) } })
    const result = await router.route(request(), [{ role: 'user', content: 'x' }])
    expect(result.fallbackUsed).toBe(true)
    expect(result.content).toBe('fallback')
    expect(traces.at(-1)?.fallback).toBe(true)
  })

  it('does not silently fallback when fallback is disabled', async () => {
    const secondModel = { ...freeFast, provider: 'fake-b', model: 'fast-b', priority: 2 }
    const router = new AiRouter(config([freeFast, secondModel], { fallback: { enabled: false, maxModels: 2, allowPaid: false } }), [new FakeAiProvider('fake-a', { type: 'error' }), new FakeAiProvider('fake-b', { type: 'success', content: 'should-not-run' })], noOpObserver)
    await expect(router.route(request(), [{ role: 'user', content: 'x' }])).rejects.toMatchObject({ detail: { code: 'provider_error' } })
  })

  it('reports unavailable providers without masking failure', async () => {
    const router = new AiRouter(config([freeFast]), [new FakeAiProvider('fake-a', { type: 'success', content: 'x' }, false)], noOpObserver)
    await expect(router.route(request(), [{ role: 'user', content: 'x' }])).rejects.toMatchObject({ detail: { code: 'provider_unavailable' } })
  })

  it('enforces timeout and cancellation', async () => {
    const timeoutRouter = new AiRouter(config([freeFast], { timeoutMs: 5, retriesPerModel: 0, fallback: { enabled: false, maxModels: 1, allowPaid: false } }), [new FakeAiProvider('fake-a', { type: 'timeout' })], noOpObserver)
    await expect(timeoutRouter.route(request(), [{ role: 'user', content: 'x' }])).rejects.toMatchObject({ detail: { code: 'timeout' } })
    const controller = new AbortController()
    controller.abort()
    const cancelRouter = new AiRouter(config([freeFast]), [new FakeAiProvider('fake-a', { type: 'timeout' })], noOpObserver)
    await expect(cancelRouter.route(request({ execution: { signal: controller.signal } }), [{ role: 'user', content: 'x' }])).rejects.toBeInstanceOf(AiRouterError)
  })

  it('retries within configured bounds', async () => {
    const provider = new FakeAiProvider('fake-a', { type: 'error' })
    const router = new AiRouter(config([freeFast], { retriesPerModel: 1 }), [provider], noOpObserver)
    await expect(router.route(request(), [{ role: 'user', content: 'x' }])).rejects.toBeInstanceOf(AiRouterError)
    expect(provider.calls).toHaveLength(2)
  })

  it('calculates token cost only when usage and pricing are known', () => {
    expect(estimateCost({ inputUnits: 1_000_000, outputUnits: 500_000, unit: 'tokens' }, paidFast)).toBe(4)
    expect(estimateCost({ totalUnits: 2, unit: 'images' }, paidFast)).toBeUndefined()
  })

  it('sanitizes provider errors from traces', async () => {
    const traces: RouterTrace[] = []
    const router = new AiRouter(config([freeFast]), [new FakeAiProvider('fake-a', { type: 'error', error: new Error('api-key=secret prompt=sensitive') })], { record: (trace) => { traces.push(trace) } })
    await expect(router.route(request(), [{ role: 'user', content: 'x' }])).rejects.toBeInstanceOf(AiRouterError)
    expect(JSON.stringify(traces)).not.toMatch(/api-key|secret|sensitive/)
    expect(traces[0]?.error).toEqual({ code: 'provider_error', retryable: true })
  })
})
