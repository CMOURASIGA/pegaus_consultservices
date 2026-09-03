import { NextResponse, type NextRequest } from 'next/server'
import { safeNextPath } from '../../../lib/auth/policy'
import { getVerifiedIdentity, syncApplicationSession } from '../../../lib/auth/server'

export async function GET(request: NextRequest) {
  try {
    const { claims } = await getVerifiedIdentity()
    await syncApplicationSession(claims, 'session_resumed')
    return NextResponse.redirect(new URL(safeNextPath(request.nextUrl.searchParams.get('next')), request.url), 303)
  } catch {
    return NextResponse.redirect(new URL('/login?error=session_expired', request.url), 303)
  }
}
