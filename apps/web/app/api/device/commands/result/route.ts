import { TaskRuntime } from '@pegasus/core'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createDeviceGateway, gatewayError, proofFromHeaders } from '../../../../../lib/device-gateway/http'
import { SupabaseOperationalRepository } from '../../../../../lib/operations/supabase-operational-repository'
import { createAdminClient } from '../../../../../lib/supabase/admin'

export const runtime = 'nodejs'
const schema = z.object({
  commandId: z.uuid(), attemptId: z.uuid(), leaseToken: z.string().min(32).max(256), commandNonce: z.string().min(32).max(256), status: z.enum(['completed', 'failed']),
  output: z.record(z.string(), z.unknown()), errorCode: z.string().max(80).optional(), agentVersion: z.string().min(1).max(40),
  evidenceDigest: z.string().max(160).optional(), correlationId: z.uuid(),
})

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json(); const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: { code: 'RESULT_INVALID', message: 'Device request rejected.' } }, { status: 400 })
    const gateway = createDeviceGateway(); const proof = proofFromHeaders(request.headers)
    const identity = await gateway.authenticate({ proof, method: request.method, path: new URL(request.url).pathname, body, requestKind: 'command_result' })
    const result = await gateway.result({ identity, result: parsed.data, requestNonce: proof.nonce })
    if (result.terminal) {
      const repository = new SupabaseOperationalRepository(createAdminClient()); const tasks = new TaskRuntime(repository)
      const task = await repository.get(result.taskId, identity.ownerId)
      if (task?.status === 'running') {
        if (result.successful) await tasks.complete(task, 'Ação local concluída e validada.', result.correlationId)
        else await tasks.fail(task, 'A ação local não pôde ser concluída.', result.correlationId)
      }
    }
    return NextResponse.json(result)
  } catch (error) { return gatewayError(error) }
}
