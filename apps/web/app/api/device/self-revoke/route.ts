import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createDeviceGateway, gatewayError, proofFromHeaders } from '../../../../lib/device-gateway/http'

export const runtime = 'nodejs'
const schema = z.object({ reason: z.literal('user_mode_agent_disconnect') })

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json(); const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: { code: 'REVOCATION_INVALID', message: 'Device request rejected.' } }, { status: 400 })
    const gateway = createDeviceGateway(); const proof = proofFromHeaders(request.headers)
    const identity = await gateway.authenticate({ proof, method: request.method, path: new URL(request.url).pathname, body, requestKind: 'self_revoke' })
    await gateway.revoke({ ownerId: identity.ownerId, deviceId: identity.deviceId, reason: parsed.data.reason })
    return NextResponse.json({ status: 'revoked' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return gatewayError(error) }
}
