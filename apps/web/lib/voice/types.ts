export type VoiceState = 'idle' | 'requesting_permission' | 'listening' | 'processing' | 'speaking' | 'cancelled' | 'error'

export type VoiceErrorCode = 'permission_denied' | 'microphone_unavailable' | 'capture_failed' | 'empty_audio' | 'unsupported' | 'audio_too_large' | 'transcription_unavailable' | 'transcription_failed'

export class VoiceError extends Error {
  constructor(readonly code: VoiceErrorCode, message: string) {
    super(message)
    this.name = 'VoiceError'
  }
}

export type CapturedAudio = {
  blob: Blob
  mediaType: string
  durationMs: number
}

export interface VoiceCaptureAdapter {
  readonly id: string
  start(onSilence?: () => void): Promise<void>
  stop(): Promise<CapturedAudio>
  cancel(): void
}

export interface SpeechToTextAdapter {
  readonly id: string
  readonly requiresCredential: boolean
  transcribe(audio: CapturedAudio, signal?: AbortSignal): Promise<{ text: string }>
}

export interface TextToSpeechAdapter {
  readonly id: string
  readonly requiresCredential: boolean
  isAvailable(): boolean
  speak(text: string, callbacks: { onEnd(): void; onError(): void }): void
  cancel(): void
}
