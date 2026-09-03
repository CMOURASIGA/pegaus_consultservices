import { NextResponse } from 'next/server'
import { getVerifiedIdentity, syncApplicationSession } from '../../../../lib/auth/server'

export async function POST() {
  try {
    const { claims } = await getVerifiedIdentity()
    await syncApplicationSession(claims, 'mfa_totp_verified')
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
}
