import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({
  loginError: null as null | { code: string },
  aal: { currentLevel: 'aal1', nextLevel: 'aal1' } as { currentLevel: string; nextLevel: string },
  factors: [] as Array<{ id: string; status: string }>,
  signOut: vi.fn(),
  sync: vi.fn(),
}))

vi.mock('../../../lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword: async () => ({ error: state.loginError }),
      getClaims: async () => ({ data: { claims: { sub: 'user-1', session_id: 'session-1', aal: state.aal.currentLevel } } }),
      signOut: state.signOut,
      mfa: {
        listFactors: async () => ({ data: { totp: state.factors } }),
        getAuthenticatorAssuranceLevel: async () => ({ data: state.aal }),
      },
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status: 'active' } }) }) }) }),
  }),
}))
vi.mock('../../../lib/auth/server', () => ({ syncApplicationSession: state.sync }))

import { POST } from './route'

function loginRequest(next = '/app') {
  const body = new URLSearchParams({ email: 'authorized@example.test', password: 'valid-password', next })
  return new NextRequest('https://pegasus.example/auth/login', { method: 'POST', body })
}

describe('POST /auth/login', () => {
  beforeEach(() => {
    state.loginError = null
    state.aal = { currentLevel: 'aal1', nextLevel: 'aal1' }
    state.factors = []
    state.sync.mockClear()
  })

  it('creates the application session and redirects an authorized aal1 user', async () => {
    const response = await POST(loginRequest('/sessions'))
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('https://pegasus.example/sessions')
    expect(state.sync).toHaveBeenCalledOnce()
  })

  it('redirects a user with verified TOTP to the challenge', async () => {
    state.aal = { currentLevel: 'aal1', nextLevel: 'aal2' }
    state.factors = [{ id: 'factor-1', status: 'verified' }]
    const response = await POST(loginRequest())
    expect(response.headers.get('location')).toBe('https://pegasus.example/security/mfa/challenge')
  })

  it('does not create a session after invalid credentials', async () => {
    state.loginError = { code: 'invalid_credentials' }
    const response = await POST(loginRequest())
    expect(response.headers.get('location')).toContain('/login?error=invalid_credentials')
    expect(state.sync).not.toHaveBeenCalled()
  })
})
