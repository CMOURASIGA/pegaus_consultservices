import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createDeviceGateway, gatewayError, proofFromHeaders } from '../../../../../lib/device-gateway/http'

export const runtime = 'nodejs'
const schema = z.object({ leaseSeconds: z.number().int().min(5).max(120).optional() })

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json(); const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: { code: 'POLL_INVALID', message: 'Device request rejected.' } }, { status: 400 })
    const gateway = createDeviceGateway(); const proof = proofFromHeaders(request.headers)
    const identity = await gateway.authenticate({ proof, method: request.method, path: new URL(request.url).pathname, body, requestKind: 'command_poll' })
    return NextResponse.json(await gateway.poll({ identity, leaseSeconds: parsed.data.leaseSeconds }), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return gatewayError(error) }
}
