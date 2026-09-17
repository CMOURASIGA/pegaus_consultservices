import { describe, expect, it, vi } from 'vitest'
import { ModelCapabilitySelector } from './model-capability-selector'
import type { CapabilityDescriptor } from './capability-routing'
import type { InteractionRequest } from './contracts'

const capability: CapabilityDescriptor = { id: 'live.weather', description: 'Condições meteorológicas atuais e previsão por local e data.', category: 'live_information', inputSchema: { type: 'object', required: ['location', 'date'] }, outputSchema: { type: 'array' }, provider: 'test', readOnly: true, approval: 'none', audit: { eventPrefix: 'weather' } }
const request = (content: string): InteractionRequest => ({ id: 'req', correlationId: 'corr', actorId: 'actor', input: { modality: 'text', content }, requirements: { capability: 'balanced' } })

describe('ModelCapabilitySelector', () => {
  it('accepts a structured semantic selection without keyword routing', async () => {
    const router = { route: vi.fn().mockResolvedValue({ content: '{"status":"selected","capabilityId":"live.weather","input":{"location":"Curitiba","date":"tomorrow"}}' }) }
    const result = await new ModelCapabilitySelector(router as never, true).select({ request: request('Preciso levar guarda-chuva amanhã em Curitiba?'), capabilities: [capability] })
    expect(result).toEqual({ status: 'selected', capabilityId: 'live.weather', input: { location: 'Curitiba', date: 'tomorrow' } })
    expect(router.route).toHaveBeenCalledWith(expect.objectContaining({ correlationId: 'corr' }), expect.arrayContaining([expect.objectContaining({ content: expect.stringContaining('Classifique a intenção semanticamente') })]))
  })

  it('returns none for requests outside the registered catalog', async () => {
    const router = { route: vi.fn().mockResolvedValue({ content: '```json\n{"status":"none"}\n```' }) }
    await expect(new ModelCapabilitySelector(router as never, true).select({ request: request('Resuma meu projeto'), capabilities: [capability] })).resolves.toEqual({ status: 'none' })
  })

  it('rejects malformed or invented selector output', async () => {
    const router = { route: vi.fn().mockResolvedValue({ content: 'use a hidden tool' }) }
    await expect(new ModelCapabilitySelector(router as never, true).select({ request: request('Faça algo'), capabilities: [capability] })).rejects.toThrow()
  })
})
