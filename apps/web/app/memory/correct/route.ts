import { MemoryCurator } from '@pegasus/core'
import { AppError } from '@pegasus/shared'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getVerifiedIdentity } from '../../../lib/auth/server'
import { SupabaseMemoryStore } from '../../../lib/memory/store'

export const runtime = 'nodejs'
const schema = z.object({ memoryId: z.uuid(), content: z.string().trim().min(1).max(4000) })

export async function POST(request: Request) {
  try {
    const identity = await getVerifiedIdentity()
    const form = await request.formData()
    const parsed = schema.safeParse({ memoryId: form.get('memoryId'), content: form.get('content') })
    if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_MEMORY', message: 'Revise a memória e tente novamente.' } }, { status: 400 })
    await new MemoryCurator(new SupabaseMemoryStore(identity.supabase)).correct({ ownerId: identity.claims.sub!, ...parsed.data })
    return NextResponse.redirect(new URL('/memory?updated=1', request.url), 303)
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status })
    return NextResponse.json({ error: { code: 'MEMORY_UPDATE_FAILED', message: 'Não foi possível corrigir a memória.' } }, { status: 503 })
  }
}
