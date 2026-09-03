import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({ signOut: vi.fn(), revoke: vi.fn() }))
vi.mock('../../../lib/supabase/server', () => ({
  createClient: async () => ({ auth: {
    getClaims: async () => ({ data: { claims: { sub: 'user-1', session_id: 'session-1' } } }),
    signOut: state.signOut,
  } }),
}))
vi.mock('../../../lib/auth/server', () => ({ revokeApplicationSession: state.revoke }))

import { POST } from './route'

describe('POST /auth/logout', () => {
  it('revokes Pegasus metadata, destroys the local Auth session and redirects', async () => {
    const response = await POST(new NextRequest('https://pegasus.example/auth/logout', { method: 'POST' }))
    expect(state.revoke).toHaveBeenCalledWith('user-1', 'session-1', 'user_logout')
    expect(state.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('https://pegasus.example/login')
  })
})
