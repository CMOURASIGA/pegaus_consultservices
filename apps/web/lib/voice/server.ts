import 'server-only'

import { readServerConfig } from '@pegasus/config'

const OPENAI_TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions'

export class OpenAiSpeechToText {
  readonly id = 'openai-gpt-transcribe'

  async transcribe(file: File, signal?: AbortSignal) {
    const { OPENAI_API_KEY } = readServerConfig()
    if (!OPENAI_API_KEY) throw new Error('TRANSCRIPTION_NOT_CONFIGURED')
    const body = new FormData()
    body.set('file', file)
    body.set('model', 'gpt-transcribe')
    body.set('language', 'pt')
    const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body,
      signal,
    })
    if (!response.ok) throw new Error('TRANSCRIPTION_PROVIDER_FAILED')
    const payload = await response.json() as { text?: unknown }
    if (typeof payload.text !== 'string' || !payload.text.trim()) throw new Error('TRANSCRIPTION_EMPTY')
    return { text: payload.text.trim() }
  }
}
