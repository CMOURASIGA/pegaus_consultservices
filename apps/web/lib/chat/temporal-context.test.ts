import { describe, expect, it } from 'vitest'
import { applicationTimeContext, resolveTimeZone } from './temporal-context'

const request = { id: 'request-1', correlationId: 'correlation-1', actorId: 'owner-1', input: { modality: 'text' as const, content: 'Que dia é hoje?' }, requirements: { capability: 'balanced' as const } }

describe('application time context', () => {
  it('adds server-controlled current time as trusted session context without persistence', async () => {
    const original = { id: 'context-1', items: [] as const }
    const context = applicationTimeContext({ assemble: async () => original }, 'America/Sao_Paulo', () => new Date('2026-09-16T20:00:00.000Z'))
    const snapshot = await context.assemble(request)
    expect(snapshot.items[0]).toMatchObject({
      source: 'application:server-clock', kind: 'trusted_session', trust: 'trusted',
      value: expect.stringContaining('16 de setembro de 2026'),
      provenance: expect.objectContaining({ sourceKind: 'application_clock', authority: 'application', sourceRef: 'server-time' }),
    })
    expect(snapshot.items).toHaveLength(1)
  })

  it('falls back to UTC for an invalid requested timezone', () => {
    expect(resolveTimeZone('not/a-timezone')).toBe('UTC')
  })
})
