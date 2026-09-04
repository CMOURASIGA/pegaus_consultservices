import { AiRouterError } from '@pegasus/core'
import { AppError } from '@pegasus/shared'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getVerifiedIdentity } from '../../../lib/auth/server'
import { ChatService } from '../../../lib/chat/service'
import { SupabaseChatStore } from '../../../lib/chat/store'

export const runtime = 'nodejs'

const bodySchema = z.object({
  conversationId: z.uuid().optional(),
  content: z.string().trim().min(1).max(12_000),
})

function errorResponse(error: unknown) {
  if (error instanceof AppError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status })
  if (error instanceof AiRouterError) {
    const status = error.detail.code === 'cancelled' ? 499 : error.detail.code === 'timeout' ? 504 : 503
    return NextResponse.json({ error: { code: error.detail.code, message: status === 499 ? 'Geração cancelada.' : 'O Pegasus não conseguiu responder agora.' } }, { status })
  }
  return NextResponse.json({ error: { code: 'CHAT_FAILED', message: 'Não foi possível concluir a mensagem.' } }, { status: 500 })
}

export async function POST(request: Request) {
  try {
    const identity = await getVerifiedIdentity()
    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_MESSAGE', message: 'Revise a mensagem e tente novamente.' } }, { status: 400 })
    const service = new ChatService(new SupabaseChatStore(identity.supabase))
    const result = await service.send({ actorId: identity.claims.sub!, content: parsed.data.content, conversationId: parsed.data.conversationId, signal: request.signal })
    return NextResponse.json(result, { status: parsed.data.conversationId ? 200 : 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return errorResponse(error)
  }
}
