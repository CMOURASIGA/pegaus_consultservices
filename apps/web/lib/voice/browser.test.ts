import { describe, expect, it } from 'vitest'
import { BrowserTextToSpeech, BrowserVoiceCapture, FakeSpeechToText, ServerSpeechToText, VoiceActivityDetector, mapMicrophoneError } from './browser'

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

  it('sends audio only to the authenticated server boundary', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      expect(input).toBe('/api/voice/transcribe')
      expect(init?.method).toBe('POST')
      expect(init?.headers).toBeUndefined()
      expect(init?.body).toBeInstanceOf(FormData)
      return Response.json({ text: 'Qual é a previsão do tempo?' })
    }
    try {
      const result = await new ServerSpeechToText().transcribe({ blob: new Blob(['audio']), mediaType: 'audio/webm', durationMs: 900 })
      expect(result.text).toBe('Qual é a previsão do tempo?')
    } finally { globalThis.fetch = originalFetch }
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

  it('ends automatically only after speech followed by silence', () => {
    const detector = new VoiceActivityDetector(0)
    expect(detector.sample(0.001, 1_000)).toBe(false)
    expect(detector.sample(0.04, 1_100)).toBe(false)
    expect(detector.sample(0.001, 2_000)).toBe(false)
    expect(detector.sample(0.001, 2_601)).toBe(true)
  })

  it('enforces the maximum capture duration even in continuous noise', () => {
    const detector = new VoiceActivityDetector(0)
    expect(detector.sample(0.04, 59_999)).toBe(false)
    expect(detector.sample(0.04, 60_000)).toBe(true)
  })
})
