import { NextResponse, type NextRequest } from 'next/server'
import { getVerifiedIdentity, revokeApplicationSession, revokeOtherApplicationSessions } from '../../../lib/auth/server'

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const { supabase, claims } = await getVerifiedIdentity()
    if (!claims.sub || !claims.session_id) throw new Error('Invalid session')
    if (form.get('scope') === 'others') {
      await supabase.auth.signOut({ scope: 'others' })
      await revokeOtherApplicationSessions(claims.sub, claims.session_id)
    } else {
      const target = String(form.get('target') ?? '')
      if (target && target !== claims.session_id) await revokeApplicationSession(claims.sub, target, 'remote_user_revocation')
    }
    return NextResponse.redirect(new URL('/sessions', request.url), 303)
  } catch {
    return NextResponse.redirect(new URL('/login?error=session_expired', request.url), 303)
  }
}
