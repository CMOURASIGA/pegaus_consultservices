import { AppError } from '@pegasus/shared'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getVerifiedIdentity } from '../../../../../lib/auth/server'
import { SupabaseDeviceGatewayRepository } from '../../../../../lib/device-gateway/supabase-repository'

export const runtime = 'nodejs'
const schema = z.object({ challengeId: z.uuid(), capabilities: z.array(z.enum(['filesystem.list'])).min(1).max(1) })

export async function POST(request: Request) {
  try {
    const identity = await getVerifiedIdentity()
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: { code: 'PAIRING_APPROVAL_INVALID', message: 'Aprovação de pareamento inválida.' } }, { status: 400 })
    await new SupabaseDeviceGatewayRepository().approvePairing({ ownerId: identity.claims.sub!, ...parsed.data })
    return NextResponse.json({ status: 'approved' })
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status })
    return NextResponse.json({ error: { code: 'PAIRING_NOT_APPROVABLE', message: 'Não foi possível aprovar o pareamento.' } }, { status: 409 })
  }
}
