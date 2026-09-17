import { describe, expect, it, vi } from 'vitest'
import { CapabilityRegistry, CapabilityRouter } from './capability-routing'
import type { CapabilityDescriptor, CapabilityProviderPort } from './capability-routing'
import type { InteractionRequest, LiveInformationEvidence } from './contracts'

const descriptor: CapabilityDescriptor = { id: 'live.weather', description: 'Weather', category: 'live_information', inputSchema: { type: 'object' }, outputSchema: { type: 'array' }, provider: 'weather-test', freshnessTtlMs: 1_800_000, readOnly: true, approval: 'none', audit: { eventPrefix: 'capability.weather' } }
const request: InteractionRequest = { id: 'req', correlationId: 'corr', actorId: 'actor', input: { modality: 'text', content: 'Preciso saber se levo guarda-chuva amanhã em Curitiba.' }, requirements: { capability: 'balanced' } }
const evidence = (validUntil = '2026-09-17T13:00:00Z'): LiveInformationEvidence[] => [{ capability: 'live.weather', provider: 'weather-test', sourceName: 'Weather Test', sourceUrl: 'https://weather.test', observedAt: '2026-09-17T12:00:00Z', retrievedAt: '2026-09-17T12:01:00Z', validUntil, value: 'Chuva provável', trust: 'untrusted_external', retention: 'ephemeral' }]

function registry(provider: CapabilityProviderPort) { return new CapabilityRegistry().register({ descriptor, provider, validateInput: (input) => Boolean(input && typeof input === 'object' && 'location' in input), validateOutput: (output) => output.length > 0 && output.every((item) => item.retention === 'ephemeral') }) }

describe('CapabilityRouter', () => {
  it('selects a registered provider from structured semantic selection and audits correlation', async () => {
    const provider: CapabilityProviderPort = { id: 'weather-test', health: async () => 'available', execute: vi.fn().mockResolvedValue(evidence()) }
    const selector = { select: vi.fn().mockResolvedValue({ status: 'selected', capabilityId: 'live.weather', input: { location: 'Curitiba', date: 'tomorrow' } }) }
    const audit = { record: vi.fn().mockResolvedValue(undefined) }
    const result = await new CapabilityRouter(registry(provider), selector, audit, () => new Date('2026-09-17T12:05:00Z')).route(request)
    expect(result).toMatchObject({ status: 'available', capability: { id: 'live.weather' } })
    expect(provider.execute).toHaveBeenCalledWith({ location: 'Curitiba', date: 'tomorrow' }, expect.objectContaining({ correlationId: 'corr' }))
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ correlationId: 'corr', type: 'capability.weather.completed' }))
  })

  it('supports a substitute provider behind the same contract', async () => {
    const substitute: CapabilityProviderPort = { id: 'weather-test', health: async () => 'available', execute: vi.fn().mockResolvedValue(evidence()) }
    const result = await new CapabilityRouter(registry(substitute), { select: async () => ({ status: 'selected', capabilityId: 'live.weather', input: { location: 'Niterói', date: 'current' } }) }, undefined, () => new Date('2026-09-17T12:05:00Z')).route(request)
    expect(result.status).toBe('available')
  })

  it('fails closed for unavailable, invalid, stale or unauthorized results', async () => {
    const selected = { select: async () => ({ status: 'selected' as const, capabilityId: 'live.weather', input: { location: 'Curitiba', date: 'current' } }) }
    const unavailable: CapabilityProviderPort = { id: 'weather-test', health: async () => 'unavailable', execute: async () => evidence() }
    await expect(new CapabilityRouter(registry(unavailable), selected).route(request)).resolves.toMatchObject({ status: 'unavailable' })
    const stale: CapabilityProviderPort = { id: 'weather-test', health: async () => 'available', execute: async () => evidence('2026-09-17T11:00:00Z') }
    await expect(new CapabilityRouter(registry(stale), selected, undefined, () => new Date('2026-09-17T12:05:00Z')).route(request)).resolves.toMatchObject({ status: 'unavailable', message: expect.stringContaining('expirados') })
    const invalidSelection = { select: async () => ({ status: 'selected' as const, capabilityId: 'unknown', input: {} }) }
    await expect(new CapabilityRouter(registry(stale), invalidSelection).route(request)).resolves.toMatchObject({ status: 'unavailable' })
  })

  it('does nothing when no capability is semantically required', async () => {
    const provider: CapabilityProviderPort = { id: 'weather-test', health: async () => 'available', execute: vi.fn() }
    await expect(new CapabilityRouter(registry(provider), { select: async () => ({ status: 'none' }) }).route(request)).resolves.toEqual({ status: 'not_applicable' })
    expect(provider.execute).not.toHaveBeenCalled()
  })

  it('returns a correlated expiring pending interaction when required input is missing', async () => {
    const provider: CapabilityProviderPort = { id: 'weather-test', health: async () => 'available', execute: vi.fn() }
    const selector = { select: async () => ({ status: 'needs_input' as const, capabilityId: 'live.weather', intent: 'consultar previsão', knownParameters: { date: 'tomorrow' }, missingParameters: ['location'], message: 'Para qual cidade?' }) }
    const result = await new CapabilityRouter(registry(provider), selector, undefined, () => new Date('2026-09-17T12:05:00Z')).route({ ...request, conversationId: '11111111-1111-4111-8111-111111111111' })
    expect(result).toMatchObject({ status: 'needs_input', pending: { conversationId: '11111111-1111-4111-8111-111111111111', capabilityId: 'live.weather', knownParameters: { date: 'tomorrow' }, missingParameters: ['location'], correlationId: 'corr', expiresAt: '2026-09-17T12:35:00.000Z' } })
    expect(provider.execute).not.toHaveBeenCalled()
  })
})
