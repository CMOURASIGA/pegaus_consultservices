import { NextResponse, type NextRequest } from 'next/server'
import { revokeApplicationSession } from '../../../lib/auth/server'
import { createClient } from '../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims as { sub?: string; session_id?: string } | undefined
  if (claims?.sub && claims.session_id) await revokeApplicationSession(claims.sub, claims.session_id, 'user_logout')
  await supabase.auth.signOut({ scope: 'local' })
  return NextResponse.redirect(new URL('/login', request.url), 303)
}
