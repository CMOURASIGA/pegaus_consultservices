import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createDeviceGateway, gatewayError, proofFromHeaders } from '../../../../../lib/device-gateway/http'

export const runtime = 'nodejs'
const schema = z.object({ nextKeyId: z.string().min(8).max(120), nextPublicKey: z.string().min(64).max(4096), nextKeySignature: z.string().min(32).max(2048) })

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json(); const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: { code: 'ROTATION_INVALID', message: 'Device request rejected.' } }, { status: 400 })
    const gateway = createDeviceGateway(); const proof = proofFromHeaders(request.headers)
    const identity = await gateway.authenticate({ proof, method: request.method, path: new URL(request.url).pathname, body, requestKind: 'identity_rotation' })
    await gateway.rotateIdentity({ ownerId: identity.ownerId, deviceId: identity.deviceId, currentKeyId: identity.keyId, ...parsed.data })
    return NextResponse.json({ status: 'rotated' })
  } catch (error) { return gatewayError(error) }
}
