import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@pegasus/shared'

const state = vi.hoisted(() => ({ authenticated: true, send: vi.fn(), upload: vi.fn(), update: vi.fn() }))

vi.mock('../../../lib/auth/server', () => ({
  getVerifiedIdentity: async () => {
    if (!state.authenticated) throw new AppError('AUTH_REQUIRED', 'Authentication required', 401)
    return {
      claims: { sub: 'owner-a' },
      supabase: { from: () => ({ update: state.update }) },
    }
  },
}))
vi.mock('../../../lib/chat/store', () => ({ SupabaseChatStore: class {} }))
vi.mock('../../../lib/chat/service', () => ({ ChatService: class { send = state.send } }))
vi.mock('../../../lib/chat/attachments', () => ({ uploadChatAttachments: state.upload }))

import { POST } from './route'

describe('POST /api/chat', () => {
  beforeEach(() => {
    state.authenticated = true
    state.send.mockReset()
    state.upload.mockReset().mockResolvedValue([])
    state.update.mockReset().mockReturnValue({ eq: () => ({ in: async () => ({ error: null }) }) })
  })

  it('rejects unauthenticated access', async () => {
    state.authenticated = false
    const response = await POST(new Request('https://pegasus.test/api/chat', { method: 'POST', body: JSON.stringify({ content: 'Olá' }) }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } })
  })

  it('validates payload before invoking the Core service', async () => {
    const response = await POST(new Request('https://pegasus.test/api/chat', { method: 'POST', body: JSON.stringify({ content: '' }) }))
    expect(response.status).toBe(400)
    expect(state.send).not.toHaveBeenCalled()
  })

  it('treats malformed JSON as a client error', async () => {
    const response = await POST(new Request('https://pegasus.test/api/chat', { method: 'POST', body: '{invalid' }))
    expect(response.status).toBe(400)
    expect(state.send).not.toHaveBeenCalled()
  })

  it('returns a created conversation from the server-side service', async () => {
    state.send.mockResolvedValue({ conversation: { id: 'c1' }, correlationId: 'corr' })
    const response = await POST(new Request('https://pegasus.test/api/chat', { method: 'POST', body: JSON.stringify({ content: 'Olá Pegasus' }) }))
    expect(response.status).toBe(201)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(state.send).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'owner-a', content: 'Olá Pegasus' }))
  })

  it('accepts multipart attachments through the authenticated server boundary', async () => {
    const attachment = { id: 'document-1', name: 'foto.png', mediaType: 'image/png', size: 8, classification: 'internal' }
    state.upload.mockResolvedValue([attachment])
    state.send.mockResolvedValue({ conversation: { id: 'c1' }, userMessage: { id: 'm1' }, correlationId: 'corr' })
    const body = new FormData()
    body.set('content', 'Considere a imagem')
    body.append('attachments', new File([new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])], 'foto.png', { type: 'image/png' }))
    const response = await POST(new Request('https://pegasus.test/api/chat', { method: 'POST', body }))
    expect(response.status).toBe(201)
    expect(state.upload).toHaveBeenCalledWith(expect.anything(), 'owner-a', [expect.objectContaining({ name: 'foto.png' })])
    expect(state.send).toHaveBeenCalledWith(expect.objectContaining({ attachments: [attachment] }))
    expect(state.update).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ external_content_trust: 'untrusted', conversation_id: 'c1', message_id: 'm1' }) }))
  })
})
