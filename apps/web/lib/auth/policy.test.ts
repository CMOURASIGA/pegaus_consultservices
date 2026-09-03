import { describe, expect, it } from 'vitest'
import { isActiveProfile, resolveMfaRoute, safeNextPath, sessionFailure } from './policy'

describe('authentication policy', () => {
  it('requires a challenge only after a verified TOTP factor exists', () => {
    expect(resolveMfaRoute({ currentLevel: 'aal1', nextLevel: 'aal2', hasVerifiedTotp: true })).toBe('/security/mfa/challenge')
    expect(resolveMfaRoute({ currentLevel: 'aal1', nextLevel: 'aal2', hasVerifiedTotp: false })).toBe('/app')
    expect(resolveMfaRoute({ currentLevel: 'aal2', nextLevel: 'aal2', hasVerifiedTotp: true })).toBe('/app')
  })

  it('accepts only local safe redirect paths', () => {
    expect(safeNextPath('/sessions')).toBe('/sessions')
    expect(safeNextPath('https://attacker.example')).toBe('/app')
    expect(safeNextPath('//attacker.example')).toBe('/app')
    expect(safeNextPath('/login?next=/sessions')).toBe('/app')
  })

  it('does not authorize suspended or absent profiles', () => {
    expect(isActiveProfile('active')).toBe(true)
    expect(isActiveProfile('suspended')).toBe(false)
    expect(isActiveProfile(undefined)).toBe(false)
  })

  it('protects private routes and handles expired or revoked sessions', () => {
    expect(sessionFailure('/app', false)).toBe('auth_required')
    expect(sessionFailure('/sessions', true, 'suspended')).toBe('account_unavailable')
    expect(sessionFailure('/security/mfa', true, 'active', true)).toBe('session_revoked')
    expect(sessionFailure('/app', true, 'active')).toBeNull()
    expect(sessionFailure('/login', false)).toBeNull()
  })
})
