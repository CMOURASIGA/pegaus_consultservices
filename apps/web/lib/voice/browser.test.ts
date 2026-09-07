import { describe, expect, it } from 'vitest'
import { BrowserTextToSpeech, BrowserVoiceCapture, FakeSpeechToText, mapMicrophoneError } from './browser'

describe('voice provider boundaries', () => {
  it('maps denied microphone access without exposing browser details', () => {
    const result = mapMicrophoneError(new DOMException('private browser detail', 'NotAllowedError'))
    expect(result).toMatchObject({ code: 'permission_denied' })
    expect(result.message).not.toContain('private browser detail')
  })

  it('uses deterministic credential-free fake transcription', async () => {
    const adapter = new FakeSpeechToText()
    const result = await adapter.transcribe({ blob: new Blob(['audio']), mediaType: 'audio/webm', durationMs: 500 })
    expect(adapter.requiresCredential).toBe(false)
    expect(result.text).toBe('Mensagem de voz recebida no ambiente de validação.')
  })

  it('honors cancellation before fake transcription', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(new FakeSpeechToText().transcribe({ blob: new Blob(['audio']), mediaType: 'audio/webm', durationMs: 500 }, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('fails safely when microphone capture is unavailable', async () => {
    await expect(new BrowserVoiceCapture().start()).rejects.toMatchObject({ code: 'unsupported' })
  })

  it('falls back to text when speech output is unavailable', () => {
    const output = new BrowserTextToSpeech()
    let ended = false
    expect(output.isAvailable()).toBe(false)
    output.speak('Resposta', { onEnd: () => { ended = true }, onError: () => undefined })
    expect(ended).toBe(true)
  })
})
