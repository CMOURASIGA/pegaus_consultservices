import 'server-only'

import { AppError } from '@pegasus/shared'
import { createAdminClient } from '../supabase/admin'
import { createClient } from '../supabase/server'
import { isActiveProfile } from './policy'

type Claims = { sub?: string; session_id?: string; aal?: string; email?: string }

export async function getVerifiedIdentity() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims as Claims | undefined
  if (error || !claims?.sub) throw new AppError('AUTH_REQUIRED', 'Authentication required', 401)

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, timezone, locale, status')
    .eq('id', claims.sub)
    .maybeSingle()
  if (profileError || !profile) throw new AppError('PROFILE_REQUIRED', 'Active profile required', 403)
  if (!isActiveProfile(profile.status)) throw new AppError('ACCOUNT_DISABLED', 'Account is unavailable', 403)
  return { supabase, claims, profile }
}

export async function syncApplicationSession(claims: Claims, eventType = 'session_started') {
  if (!claims.sub || !claims.session_id) throw new AppError('SESSION_INVALID', 'Session identifier is missing', 401)
  const admin = createAdminClient()
  const aal = claims.aal === 'aal2' ? 'aal2' : 'aal1'
  const now = new Date().toISOString()
  const { data: existing, error: lookupError } = await admin.from('pegasus_sessions')
    .select('id')
    .eq('auth_session_id', claims.session_id)
    .maybeSingle()
  if (lookupError) throw new AppError('SESSION_SYNC_FAILED', 'Unable to find application session', 503)
  const operation = existing
    ? admin.from('pegasus_sessions').update({ aal, last_activity_at: now, revoked_at: null, revoke_reason: null }).eq('id', existing.id).select('id').single()
    : admin.from('pegasus_sessions').insert({ owner_id: claims.sub, auth_session_id: claims.session_id, aal, last_activity_at: now }).select('id').single()
  const { data: session, error } = await operation
  if (error) throw new AppError('SESSION_SYNC_FAILED', 'Unable to synchronize application session', 503)
  const { error: auditError } = await admin.from('auth_security_events').insert({
    owner_id: claims.sub,
    pegasus_session_id: session.id,
    event_type: eventType,
    outcome: 'success',
    auth_method: aal === 'aal2' ? 'password_totp' : 'password',
    metadata: {},
  })
  if (auditError) throw new AppError('AUTH_AUDIT_FAILED', 'Unable to record security event', 503)
  return session.id as string
}

export async function revokeApplicationSession(ownerId: string, authSessionId: string, reason: string) {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await admin.from('pegasus_sessions')
    .update({ revoked_at: now, revoke_reason: reason })
    .eq('owner_id', ownerId)
    .eq('auth_session_id', authSessionId)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle()
  if (error) throw new AppError('SESSION_REVOKE_FAILED', 'Unable to revoke session', 503)
  if (data) await admin.from('auth_security_events').insert({
    owner_id: ownerId,
    pegasus_session_id: data.id,
    event_type: 'session_revoked',
    outcome: 'revoked',
    metadata: { reason },
  })
  return Boolean(data)
}

export async function revokeOtherApplicationSessions(ownerId: string, currentAuthSessionId: string) {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await admin.from('pegasus_sessions')
    .update({ revoked_at: now, revoke_reason: 'remote_kill_switch' })
    .eq('owner_id', ownerId)
    .neq('auth_session_id', currentAuthSessionId)
    .is('revoked_at', null)
    .select('id')
  if (error) throw new AppError('SESSION_REVOKE_FAILED', 'Unable to revoke other sessions', 503)
  await admin.from('auth_security_events').insert({
    owner_id: ownerId,
    event_type: 'other_sessions_revoked',
    outcome: 'revoked',
    metadata: { revoked_count: data?.length ?? 0 },
  })
  return data?.length ?? 0
}
