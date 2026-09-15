import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createDeviceGateway, gatewayError } from '../../../../../lib/device-gateway/http'

export const runtime = 'nodejs'
const schema = z.object({
  challengeId: z.uuid(), token: z.string().min(32).max(256), keyId: z.string().min(8).max(120),
  publicKey: z.string().min(64).max(4096), registrationNonce: z.string().min(16).max(256),
  registrationSignature: z.string().min(32).max(2048),
})

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: { code: 'PAIRING_INVALID', message: 'Device request rejected.' } }, { status: 400 })
    const result = await createDeviceGateway().completePairing(parsed.data)
    return NextResponse.json({ deviceId: result.deviceId, correlationId: result.correlationId }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return gatewayError(error) }
}
