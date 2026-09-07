import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ key: 'server-only-test-key-value' }))
vi.mock('@pegasus/config', () => ({ readServerConfig: () => ({ OPENAI_API_KEY: state.key }) }))

import { OpenAiSpeechToText } from './server'

describe('OpenAI speech-to-text adapter', () => {
  beforeEach(() => { state.key = 'server-only-test-key-value'; vi.restoreAllMocks() })

  it('keeps the credential in the server request and returns only transcript text', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      expect(init?.headers).toEqual({ Authorization: 'Bearer server-only-test-key-value' })
      const form = init?.body as FormData
      expect(form.get('model')).toBe('gpt-transcribe')
      expect(form.get('language')).toBe('pt')
      return Response.json({ text: '  Mensagem reconhecida.  ' })
    })
    await expect(new OpenAiSpeechToText().transcribe(new File(['audio'], 'voice.webm', { type: 'audio/webm' }))).resolves.toEqual({ text: 'Mensagem reconhecida.' })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('does not call a paid provider without a configured key', async () => {
    state.key = ''
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    await expect(new OpenAiSpeechToText().transcribe(new File(['audio'], 'voice.webm', { type: 'audio/webm' }))).rejects.toThrow('TRANSCRIPTION_NOT_CONFIGURED')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
