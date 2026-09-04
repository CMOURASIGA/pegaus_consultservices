import { readPublicConfig } from '@pegasus/config'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isProtectedPath } from '../auth/policy'

export async function updateSession(request: NextRequest, requestHeaders = new Headers(request.headers)) {
  let response = NextResponse.next({ request: { headers: requestHeaders } })
  const config = readPublicConfig()
  if (!config.NEXT_PUBLIC_SUPABASE_URL || !config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return response

  const supabase = createServerClient(config.NEXT_PUBLIC_SUPABASE_URL, config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        requestHeaders.set('cookie', request.cookies.toString())
        response = NextResponse.next({ request: { headers: requestHeaders } })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
      },
    },
  })

  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims as { sub?: string; session_id?: string } | undefined
  const isProtected = isProtectedPath(request.nextUrl.pathname)

  if (!claims?.sub && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  if (claims?.sub && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/bootstrap'
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (claims?.sub && claims.session_id && isProtected) {
    const [{ data: profile }, { data: session }] = await Promise.all([
      supabase.from('profiles').select('status').eq('id', claims.sub).maybeSingle(),
      supabase.from('pegasus_sessions').select('revoked_at').eq('auth_session_id', claims.session_id).maybeSingle(),
    ])
    if (profile?.status !== 'active') {
      await supabase.auth.signOut({ scope: 'local' })
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.search = 'error=account_unavailable'
      return NextResponse.redirect(url)
    }
    if (!session) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/bootstrap'
      url.searchParams.set('next', request.nextUrl.pathname)
      return NextResponse.redirect(url)
    }
    if (session.revoked_at) {
      await supabase.auth.signOut({ scope: 'local' })
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.search = 'error=session_revoked'
      return NextResponse.redirect(url)
    }
  }
  return response
}
