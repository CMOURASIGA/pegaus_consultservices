import { NextResponse } from 'next/server'
import { getVerifiedIdentity } from '../../../../lib/auth/server'
import { OpenAiSpeechToText } from '../../../../lib/voice/server'

export const runtime = 'nodejs'

const MAX_AUDIO_BYTES = 10 * 1024 * 1024
const MAX_AUDIO_DURATION_MS = 60_000
const ALLOWED_AUDIO_TYPES = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav']

export async function POST(request: Request) {
  try {
    await getVerifiedIdentity()
    const form = await request.formData().catch(() => null)
    const audio = form?.get('audio')
    const durationMs = Number(form?.get('durationMs'))
    if (!(audio instanceof File) || !audio.size || !ALLOWED_AUDIO_TYPES.some((type) => audio.type.startsWith(type))) {
      return NextResponse.json({ error: { code: 'INVALID_AUDIO', message: 'O áudio enviado não é válido.' } }, { status: 400 })
    }
    if (audio.size > MAX_AUDIO_BYTES || !Number.isFinite(durationMs) || durationMs <= 0 || durationMs > MAX_AUDIO_DURATION_MS) {
      return NextResponse.json({ error: { code: 'AUDIO_LIMIT', message: 'Grave uma mensagem de até 60 segundos.' } }, { status: 413 })
    }
    const result = await new OpenAiSpeechToText().transcribe(audio, request.signal)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'Authentication required') return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Sua sessão expirou. Entre novamente.' } }, { status: 401 })
    if (message === 'TRANSCRIPTION_NOT_CONFIGURED') return NextResponse.json({ error: { code: 'TRANSCRIPTION_UNAVAILABLE', message: 'A transcrição de voz ainda não está configurada neste ambiente.' } }, { status: 503 })
    return NextResponse.json({ error: { code: 'TRANSCRIPTION_FAILED', message: 'Não foi possível compreender o áudio. Tente novamente.' } }, { status: 502 })
  }
}
