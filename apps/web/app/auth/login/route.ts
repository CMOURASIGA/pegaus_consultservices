import { logger } from '@pegasus/logging'
import { NextResponse, type NextRequest } from 'next/server'
import { resolveMfaRoute, safeNextPath } from '../../../lib/auth/policy'
import { syncApplicationSession } from '../../../lib/auth/server'
import { createClient } from '../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const email = String(form.get('email') ?? '').trim()
  const password = String(form.get('password') ?? '')
  const requestedNext = safeNextPath(form.get('next'))
  if (!email || !password) return NextResponse.redirect(new URL('/login?error=invalid_credentials', request.url), 303)

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    logger.warn('auth.login.failed', { reason: error.code })
    return NextResponse.redirect(new URL('/login?error=invalid_credentials', request.url), 303)
  }

  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as { sub?: string; session_id?: string; aal?: string } | undefined
  if (!claims?.sub) {
    await supabase.auth.signOut({ scope: 'local' })
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url), 303)
  }
  const { data: profile } = await supabase.from('profiles').select('status').eq('id', claims.sub).maybeSingle()
  if (profile?.status !== 'active') {
    await supabase.auth.signOut({ scope: 'local' })
    return NextResponse.redirect(new URL('/login?error=account_unavailable', request.url), 303)
  }

  await syncApplicationSession(claims)
  const [{ data: factors }, { data: aal }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ])
  const route = resolveMfaRoute({
    currentLevel: aal?.currentLevel === 'aal2' ? 'aal2' : aal?.currentLevel === 'aal1' ? 'aal1' : null,
    nextLevel: aal?.nextLevel === 'aal2' ? 'aal2' : aal?.nextLevel === 'aal1' ? 'aal1' : null,
    hasVerifiedTotp: Boolean(factors?.totp.some((factor) => factor.status === 'verified')),
  })
  const destination = route === '/app' ? requestedNext : route
  return NextResponse.redirect(new URL(destination, request.url), 303)
}
