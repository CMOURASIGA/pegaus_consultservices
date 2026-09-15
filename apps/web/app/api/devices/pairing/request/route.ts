import { AppError } from '@pegasus/shared'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getVerifiedIdentity } from '../../../../../lib/auth/server'
import { createDeviceGateway, gatewayError } from '../../../../../lib/device-gateway/http'

export const runtime = 'nodejs'
const schema = z.object({
  friendlyName: z.string().trim().min(1).max(120), operatingSystem: z.string().trim().min(1).max(120),
  agentVersion: z.string().trim().min(1).max(40), requestedCapabilities: z.array(z.enum(['filesystem.list'])).min(1).max(1),
  requestedTrust: z.enum(['temporary', 'trusted']).default('temporary'),
})

export async function POST(request: Request) {
  try {
    const identity = await getVerifiedIdentity()
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: { code: 'PAIRING_REQUEST_INVALID', message: 'Solicitação de pareamento inválida.' } }, { status: 400 })
    const challenge = await createDeviceGateway().createPairing({ ownerId: identity.claims.sub!, ...parsed.data })
    return NextResponse.json({ challengeId: challenge.id, pairingToken: challenge.token, expiresAt: challenge.expiresAt }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status })
    return gatewayError(error)
  }
}
