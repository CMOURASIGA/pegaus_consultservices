export type AssuranceLevel = 'aal1' | 'aal2'

export type MfaState = {
  currentLevel: AssuranceLevel | null
  nextLevel: AssuranceLevel | null
  hasVerifiedTotp: boolean
}

export function resolveMfaRoute(state: MfaState): '/app' | '/security/mfa/challenge' {
  if (state.hasVerifiedTotp && state.nextLevel === 'aal2' && state.currentLevel !== 'aal2') {
    return '/security/mfa/challenge'
  }
  return '/app'
}

export function safeNextPath(value: FormDataEntryValue | string | null | undefined): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/app'
  if (value.startsWith('/login') || value.startsWith('/auth')) return '/app'
  return value
}

export function isActiveProfile(status: unknown): boolean {
  return status === 'active'
}

export function isProtectedPath(pathname: string): boolean {
  return ['/app', '/sessions', '/security'].some((prefix) => pathname.startsWith(prefix))
}

export function sessionFailure(pathname: string, authenticated: boolean, profileStatus?: string, revoked = false) {
  if (!isProtectedPath(pathname)) return null
  if (!authenticated) return 'auth_required' as const
  if (!isActiveProfile(profileStatus)) return 'account_unavailable' as const
  if (revoked) return 'session_revoked' as const
  return null
}
