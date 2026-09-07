'use client'

import type { CapturedAudio, SpeechToTextAdapter, TextToSpeechAdapter, VoiceCaptureAdapter } from './types'
import { VoiceError } from './types'

const FALLBACK_MEDIA_TYPE = 'audio/webm'

export function mapMicrophoneError(error: unknown) {
  if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
    return new VoiceError('permission_denied', 'O acesso ao microfone foi negado. Libere a permissão do navegador para usar voz.')
  }
  if (error instanceof DOMException && (error.name === 'NotFoundError' || error.name === 'NotReadableError')) {
    return new VoiceError('microphone_unavailable', 'Nenhum microfone disponível foi encontrado.')
  }
  return error instanceof VoiceError ? error : new VoiceError('capture_failed', 'Não foi possível iniciar a captura de voz.')
}

export class BrowserVoiceCapture implements VoiceCaptureAdapter {
  readonly id = 'browser-media-recorder'
  private recorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private chunks: Blob[] = []
  private startedAt = 0

  async start() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      throw new VoiceError('unsupported', 'Este navegador não oferece captura de voz compatível.')
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type))
      this.recorder = preferred ? new MediaRecorder(this.stream, { mimeType: preferred }) : new MediaRecorder(this.stream)
      this.chunks = []
      this.recorder.addEventListener('dataavailable', (event) => { if (event.data.size) this.chunks.push(event.data) })
      this.recorder.start()
      this.startedAt = performance.now()
    } catch (error) {
      this.release()
      throw mapMicrophoneError(error)
    }
  }

  async stop() {
    const recorder = this.recorder
    if (!recorder || recorder.state === 'inactive') throw new VoiceError('capture_failed', 'Não existe uma gravação ativa.')
    const durationMs = Math.max(0, performance.now() - this.startedAt)
    return await new Promise<CapturedAudio>((resolve, reject) => {
      recorder.addEventListener('stop', () => {
        const mediaType = recorder.mimeType || FALLBACK_MEDIA_TYPE
        const blob = new Blob(this.chunks, { type: mediaType })
        this.release()
        if (!blob.size) reject(new VoiceError('empty_audio', 'Nenhum áudio foi capturado.'))
        else resolve({ blob, mediaType, durationMs })
      }, { once: true })
      recorder.addEventListener('error', () => { this.release(); reject(new VoiceError('capture_failed', 'A captura de voz foi interrompida.')) }, { once: true })
      recorder.stop()
    })
  }

  cancel() {
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop()
    this.chunks = []
    this.release()
  }

  private release() {
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    this.recorder = null
  }
}

export class FakeSpeechToText implements SpeechToTextAdapter {
  readonly id = 'pegasus-fake-stt'
  readonly requiresCredential = false

  async transcribe(audio: CapturedAudio, signal?: AbortSignal) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
    if (!audio.blob.size) throw new VoiceError('empty_audio', 'Nenhum áudio foi capturado.')
    return { text: 'Mensagem de voz recebida no ambiente de validação.' }
  }
}

export class BrowserTextToSpeech implements TextToSpeechAdapter {
  readonly id = 'browser-speech-synthesis'
  readonly requiresCredential = false

  isAvailable() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
  }

  speak(text: string, callbacks: { onEnd(): void; onError(): void }) {
    if (!this.isAvailable()) { callbacks.onEnd(); return }
    this.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'pt-BR'
    utterance.rate = 1
    utterance.onend = callbacks.onEnd
    utterance.onerror = callbacks.onError
    window.speechSynthesis.speak(utterance)
  }

  cancel() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  }
}
