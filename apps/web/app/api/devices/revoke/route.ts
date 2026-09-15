import { AppError } from '@pegasus/shared'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getVerifiedIdentity } from '../../../../lib/auth/server'
import { createDeviceGateway, gatewayError } from '../../../../lib/device-gateway/http'

export const runtime = 'nodejs'
const schema = z.object({ deviceId: z.uuid(), reason: z.string().trim().min(3).max(160) })

export async function POST(request: Request) {
  try {
    const identity = await getVerifiedIdentity()
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: { code: 'REVOCATION_INVALID', message: 'Revogação inválida.' } }, { status: 400 })
    await createDeviceGateway().revoke({ ownerId: identity.claims.sub!, ...parsed.data })
    return NextResponse.json({ status: 'revoked' })
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status })
    return gatewayError(error)
  }
}
