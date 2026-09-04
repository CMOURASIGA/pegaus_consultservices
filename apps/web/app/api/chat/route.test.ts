import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@pegasus/shared'

const state = vi.hoisted(() => ({ authenticated: true, send: vi.fn() }))

vi.mock('../../../lib/auth/server', () => ({
  getVerifiedIdentity: async () => {
    if (!state.authenticated) throw new AppError('AUTH_REQUIRED', 'Authentication required', 401)
    return { claims: { sub: 'owner-a' }, supabase: {} }
  },
}))
vi.mock('../../../lib/chat/store', () => ({ SupabaseChatStore: class {} }))
vi.mock('../../../lib/chat/service', () => ({ ChatService: class { send = state.send } }))

import { POST } from './route'

describe('POST /api/chat', () => {
  beforeEach(() => { state.authenticated = true; state.send.mockReset() })

  it('rejects unauthenticated access', async () => {
    state.authenticated = false
    const response = await POST(new Request('https://pegasus.test/api/chat', { method: 'POST', body: JSON.stringify({ content: 'Olá' }) }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } })
  })

  it('validates payload before invoking the Core service', async () => {
    const response = await POST(new Request('https://pegasus.test/api/chat', { method: 'POST', body: JSON.stringify({ content: '' }) }))
    expect(response.status).toBe(400)
    expect(state.send).not.toHaveBeenCalled()
  })

  it('treats malformed JSON as a client error', async () => {
    const response = await POST(new Request('https://pegasus.test/api/chat', { method: 'POST', body: '{invalid' }))
    expect(response.status).toBe(400)
    expect(state.send).not.toHaveBeenCalled()
  })

  it('returns a created conversation from the server-side service', async () => {
    state.send.mockResolvedValue({ conversation: { id: 'c1' }, correlationId: 'corr' })
    const response = await POST(new Request('https://pegasus.test/api/chat', { method: 'POST', body: JSON.stringify({ content: 'Olá Pegasus' }) }))
    expect(response.status).toBe(201)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(state.send).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'owner-a', content: 'Olá Pegasus' }))
  })
})
