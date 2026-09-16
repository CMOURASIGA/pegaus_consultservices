import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createDeviceGateway, gatewayError, proofFromHeaders } from '../../../../../lib/device-gateway/http'

export const runtime = 'nodejs'
const schema = z.object({ commandId: z.uuid(), attemptId: z.uuid(), leaseToken: z.string().min(32).max(256), commandNonce: z.string().min(32).max(256), state: z.enum(['accepted', 'rejected']), errorCode: z.string().max(80).optional() })

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json(); const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: { code: 'RECEIPT_INVALID', message: 'Device request rejected.' } }, { status: 400 })
    const gateway = createDeviceGateway(); const proof = proofFromHeaders(request.headers)
    const identity = await gateway.authenticate({ proof, method: request.method, path: new URL(request.url).pathname, body, requestKind: 'command_receipt' })
    return NextResponse.json(await gateway.receipt({ identity, receipt: parsed.data, requestNonce: proof.nonce }))
  } catch (error) { return gatewayError(error) }
}
