import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@pegasus/shared'

const state = vi.hoisted(() => ({ authenticated: true, correct: vi.fn(), archive: vi.fn() }))

vi.mock('../../lib/auth/server', () => ({
  getVerifiedIdentity: async () => {
    if (!state.authenticated) throw new AppError('AUTH_REQUIRED', 'Authentication required', 401)
    return { claims: { sub: 'owner-a' }, supabase: {} }
  },
}))
vi.mock('../../lib/memory/store', () => ({ SupabaseMemoryStore: class { archive = state.archive } }))
vi.mock('@pegasus/core', () => ({ MemoryCurator: class { correct = state.correct } }))

import { POST as correct } from './correct/route'
import { POST as archive } from './archive/route'

const memoryId = '80b86860-8e46-4c84-9c7f-f24c840cbbc8'

describe('memory mutation routes', () => {
  beforeEach(() => { state.authenticated = true; state.correct.mockReset(); state.archive.mockReset() })

  it('corrects only through the authenticated owner boundary', async () => {
    const body = new FormData(); body.set('memoryId', memoryId); body.set('content', 'A preferência corrigida')
    const response = await correct(new Request('https://pegasus.test/memory/correct', { method: 'POST', body }))
    expect(response.status).toBe(303)
    expect(state.correct).toHaveBeenCalledWith({ ownerId: 'owner-a', memoryId, content: 'A preferência corrigida' })
  })

  it('archives only through the authenticated owner boundary', async () => {
    const body = new FormData(); body.set('memoryId', memoryId)
    const response = await archive(new Request('https://pegasus.test/memory/archive', { method: 'POST', body }))
    expect(response.status).toBe(303)
    expect(state.archive).toHaveBeenCalledWith('owner-a', memoryId)
  })

  it('rejects invalid and unauthenticated mutations', async () => {
    const invalid = new FormData(); invalid.set('memoryId', 'not-a-uuid'); invalid.set('content', '')
    expect((await correct(new Request('https://pegasus.test/memory/correct', { method: 'POST', body: invalid }))).status).toBe(400)
    state.authenticated = false
    const valid = new FormData(); valid.set('memoryId', memoryId)
    expect((await archive(new Request('https://pegasus.test/memory/archive', { method: 'POST', body: valid }))).status).toBe(401)
  })
})
