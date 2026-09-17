import { describe, expect, it } from 'vitest'
import { buildConversationWorkingContext } from './working-context'
import type { ChatMessage } from './types'

const message = (index: number): ChatMessage => ({ id: `m${index}`, conversationId: 'c1', role: index % 2 ? 'assistant' : 'user', content: `turno ${index} ${'x'.repeat(1_000)}`, createdAt: `2026-09-17T12:0${index}:00Z` })

describe('conversation working context', () => {
  it('limits and sanitizes recent turns and accepts only pending state for the same unexpired conversation', () => {
    const context = buildConversationWorkingContext({ conversationId: 'c1', messages: Array.from({ length: 9 }, (_, index) => message(index)), stored: { recentTurns: [], pending: { conversationId: 'c1', capabilityId: 'live.weather', intent: 'consultar', knownParameters: { location: 'Rio\u0000de Janeiro', nested: { unsafe: true } }, missingParameters: ['date'], createdAt: '2026-09-17T12:00:00Z', updatedAt: '2026-09-17T12:01:00Z', expiresAt: '2026-09-17T13:00:00Z', status: 'pending', correlationId: 'corr' } }, now: new Date('2026-09-17T12:05:00Z') })
    expect(context.recentTurns).toHaveLength(6)
    expect(context.recentTurns[0]?.content.length).toBeLessThanOrEqual(800)
    expect(context.pending?.knownParameters).toEqual({ location: 'Rio de Janeiro' })
  })

  it('drops expired pending state without touching conversation history', () => {
    const context = buildConversationWorkingContext({ conversationId: 'c1', messages: [message(1)], stored: { recentTurns: [], pending: { conversationId: 'c1', capabilityId: 'live.weather', intent: 'consultar', knownParameters: {}, missingParameters: ['location'], createdAt: '2026-09-17T11:00:00Z', updatedAt: '2026-09-17T11:01:00Z', expiresAt: '2026-09-17T11:30:00Z', status: 'pending', correlationId: 'corr' } }, now: new Date('2026-09-17T12:05:00Z') })
    expect(context.pending).toBeUndefined()
    expect(context.recentTurns).toHaveLength(1)
  })
})
