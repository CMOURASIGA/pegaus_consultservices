import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createDeviceGateway, gatewayError, proofFromHeaders } from '../../../../lib/device-gateway/http'

export const runtime = 'nodejs'
const schema = z.object({ agentVersion: z.string().min(1).max(40), operatingSystem: z.string().min(1).max(120), capabilities: z.array(z.enum(['filesystem.list'])).max(1) })

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json(); const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: { code: 'HEARTBEAT_INVALID', message: 'Device request rejected.' } }, { status: 400 })
    const gateway = createDeviceGateway(); const proof = proofFromHeaders(request.headers)
    const identity = await gateway.authenticate({ proof, method: request.method, path: new URL(request.url).pathname, body, requestKind: 'heartbeat' })
    return NextResponse.json(await gateway.heartbeat({ identity, ...parsed.data }), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return gatewayError(error) }
}
