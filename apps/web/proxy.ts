import type { NextRequest } from 'next/server'
import { createContentSecurityPolicy } from './lib/security/csp'
import { updateSession } from './lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll('-', '')
  const contentSecurityPolicy = createContentSecurityPolicy(nonce)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy)

  const response = await updateSession(request, requestHeaders)
  response.headers.set('Content-Security-Policy', contentSecurityPolicy)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|sw.js|manifest.webmanifest|api/health).*)'],
}
