import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@pegasus/shared'

const state = vi.hoisted(() => ({ authenticated: true, transcribe: vi.fn() }))
vi.mock('../../../../lib/auth/server', () => ({ getVerifiedIdentity: async () => {
  if (!state.authenticated) throw new AppError('AUTH_REQUIRED', 'Authentication required', 401)
  return { claims: { sub: 'owner-a' } }
} }))
vi.mock('../../../../lib/voice/server', () => ({ OpenAiSpeechToText: class { transcribe = state.transcribe } }))

import { POST } from './route'

function request(file = new File(['audio'], 'voice.webm', { type: 'audio/webm' }), durationMs = 1000) {
  const body = new FormData(); body.set('audio', file); body.set('durationMs', String(durationMs))
  return new Request('https://pegasus.test/api/voice/transcribe', { method: 'POST', body })
}

describe('POST /api/voice/transcribe', () => {
  beforeEach(() => { state.authenticated = true; state.transcribe.mockReset().mockResolvedValue({ text: 'Mensagem reconhecida' }) })

  it('requires an authenticated active profile', async () => {
    state.authenticated = false
    const response = await POST(request())
    expect(response.status).toBe(401)
    expect(state.transcribe).not.toHaveBeenCalled()
  })

  it('returns the real transcript without caching it', async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ text: 'Mensagem reconhecida' })
  })

  it('rejects recordings longer than the controlled limit', async () => {
    const response = await POST(request(undefined, 60_001))
    expect(response.status).toBe(413)
    expect(state.transcribe).not.toHaveBeenCalled()
  })

  it('sanitizes provider failures', async () => {
    state.transcribe.mockRejectedValue(new Error('private provider detail'))
    const response = await POST(request())
    expect(response.status).toBe(502)
    expect(JSON.stringify(await response.json())).not.toContain('private provider detail')
  })
})
