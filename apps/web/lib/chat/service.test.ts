import { describe, expect, it, vi } from 'vitest'
import { AiRouterError } from '@pegasus/core'
import { AppError } from '@pegasus/shared'
import { ChatService, createChatCore } from './service'
import type { ChatAttachment, ChatConversation, ChatMessage, ChatStore } from './types'

class MemoryChatStore implements ChatStore {
  conversations: Array<ChatConversation & { ownerId: string }> = []
  messages: Array<ChatMessage & { ownerId: string; provider?: string; model?: string }> = []
  async listConversations(ownerId: string) { return this.conversations.filter((item) => item.ownerId === ownerId) }
  async getConversation(ownerId: string, id: string) { return this.conversations.find((item) => item.ownerId === ownerId && item.id === id) ?? null }
  async listMessages(ownerId: string, conversationId: string) { return this.messages.filter((item) => item.ownerId === ownerId && item.conversationId === conversationId) }
  async createConversation(ownerId: string, title: string) {
    const item = { id: crypto.randomUUID(), ownerId, title, updatedAt: new Date().toISOString() }
    this.conversations.push(item); return item
  }
  async createMessage(input: { ownerId: string; conversationId: string; role: 'user' | 'assistant'; content: string; correlationId: string; provider?: string; model?: string; attachments?: ChatAttachment[] }) {
    if (!await this.getConversation(input.ownerId, input.conversationId)) throw new AppError('CONVERSATION_NOT_FOUND', 'Conversa não encontrada.', 404)
    const item = { id: crypto.randomUUID(), ownerId: input.ownerId, conversationId: input.conversationId, role: input.role, content: input.content, correlationId: input.correlationId, provider: input.provider, model: input.model, attachments: input.attachments, createdAt: new Date().toISOString() }
    this.messages.push(item); return item
  }
}

describe('ChatService', () => {
  it('creates a conversation and persists user and fake assistant messages', async () => {
    const store = new MemoryChatStore()
    const result = await new ChatService(store, createChatCore('Resposta fake segura.')).send({ actorId: 'owner-a', content: 'Organize meu projeto' })
    expect(result.conversation.title).toBe('Organize meu projeto')
    expect(store.messages.map((item) => item.role)).toEqual(['user', 'assistant'])
    expect(result.assistantMessage.content).toBe('Resposta fake segura.')
    expect(result.provider).toBe('pegasus-fake')
    expect(result.correlationId).toBe(result.userMessage.correlationId)
  })

  it('continues an existing owner conversation', async () => {
    const store = new MemoryChatStore()
    const existing = await store.createConversation('owner-a', 'Planejamento')
    const result = await new ChatService(store).send({ actorId: 'owner-a', conversationId: existing.id, content: 'Continue' })
    expect(result.conversation.id).toBe(existing.id)
    expect(await store.listMessages('owner-a', existing.id)).toHaveLength(2)
  })

  it('does not allow a different owner to use the conversation', async () => {
    const store = new MemoryChatStore()
    const existing = await store.createConversation('owner-a', 'Privada')
    await expect(new ChatService(store).send({ actorId: 'owner-b', conversationId: existing.id, content: 'Tente acessar' })).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND', status: 404 })
  })

  it('keeps the user message and sanitizes provider failure', async () => {
    const store = new MemoryChatStore()
    const failingCore = { handle: async () => { throw new Error('provider secret detail') } }
    await expect(new ChatService(store, failingCore).send({ actorId: 'owner-a', content: 'Teste' })).rejects.toMatchObject({ code: 'GENERATION_FAILED', status: 503 })
    expect(store.messages).toHaveLength(1)
    expect(JSON.stringify(store.messages)).not.toContain('provider secret detail')
  })

  it('maps timeout and cancellation without exposing provider details', async () => {
    const store = new MemoryChatStore()
    await expect(new ChatService(store, { handle: async () => { throw new AiRouterError({ code: 'timeout', retryable: true }) } }).send({ actorId: 'owner-a', content: 'Timeout' })).rejects.toMatchObject({ code: 'GENERATION_TIMEOUT', status: 504 })
    await expect(new ChatService(store, { handle: async () => { throw new AiRouterError({ code: 'cancelled', retryable: false }) } }).send({ actorId: 'owner-a', content: 'Cancel' })).rejects.toMatchObject({ code: 'GENERATION_CANCELLED', status: 499 })
  })

  it('validates empty and excessive messages before persistence', async () => {
    const store = new MemoryChatStore()
    await expect(new ChatService(store).send({ actorId: 'owner-a', content: '   ' })).rejects.toMatchObject({ code: 'MESSAGE_EMPTY' })
    await expect(new ChatService(store).send({ actorId: 'owner-a', content: 'a'.repeat(12_001) })).rejects.toMatchObject({ code: 'MESSAGE_TOO_LARGE' })
    expect(store.conversations).toHaveLength(0)
  })

  it('routes attachment references as multimodal without forwarding file content', async () => {
    const store = new MemoryChatStore()
    const handle = vi.fn().mockResolvedValue({
      content: 'Anexo recebido em modo seguro.',
      route: { provider: 'pegasus-fake', model: 'local-safe-v1' },
    })
    const attachment: ChatAttachment = { id: 'document-1', name: 'foto.png', mediaType: 'image/png', size: 8, classification: 'internal' }
    await new ChatService(store, { handle }).send({ actorId: 'owner-a', content: 'Considere este anexo', attachments: [attachment] })
    expect(handle).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({ attachments: [{ id: 'document-1', mediaType: 'image/png' }] }),
      requirements: expect.objectContaining({ capability: 'multimodal', requiredModalities: ['text', 'image'] }),
      execution: expect.objectContaining({ allowPaidModels: false }),
    }))
    expect(JSON.stringify(handle.mock.calls)).not.toContain('foto.png')
    expect(store.messages[0]?.attachments).toEqual([attachment])
  })

  it('runs selective curation after persisting the user message', async () => {
    const store = new MemoryChatStore()
    const curator = { capture: vi.fn().mockResolvedValue({ action: 'persist', memory: { id: 'memory-1' } }) }
    const result = await new ChatService(store, createChatCore(), curator).send({ actorId: 'owner-a', content: 'Lembre que prefiro revisar a SPEC' })
    expect(curator.capture).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'owner-a', content: 'Lembre que prefiro revisar a SPEC', source: { kind: 'user_message', ref: `message:${result.userMessage.id}` } }))
    expect(result.memory).toEqual({ action: 'persist', memoryId: 'memory-1' })
  })

  it('continues the conversation when optional memory curation fails', async () => {
    const store = new MemoryChatStore()
    const curator = { capture: vi.fn().mockRejectedValue(new Error('database private detail')) }
    const result = await new ChatService(store, createChatCore('Resposta preservada.'), curator).send({ actorId: 'owner-a', content: 'Minha esposa se chama Teste.' })
    expect(result.assistantMessage.content).toBe('Resposta preservada.')
    expect(result.memory).toEqual({ action: 'discard', reason: 'curation_failed' })
    expect(store.messages).toHaveLength(2)
  })

  it('keeps live information ephemeral and out of memory curation', async () => {
    const store = new MemoryChatStore()
    const curator = { capture: vi.fn() }
    const liveInformation = { resolve: vi.fn().mockResolvedValue({ status: 'available', evidence: [{ capability: 'weather', provider: 'test-weather', sourceName: 'Test Weather', sourceUrl: 'https://weather.test/forecast', observedAt: '2026-09-17T09:00:00Z', retrievedAt: '2026-09-17T09:01:00Z', validUntil: '2026-09-17T09:31:00Z', value: '18 °C', trust: 'untrusted_external', retention: 'ephemeral' }] }) }
    const handle = vi.fn().mockResolvedValue({ content: '18 °C. Fonte: Test Weather, consultada às 09:01.', route: { provider: 'pegasus-fake', model: 'local-safe-v1' } })
    const result = await new ChatService(store, { handle }, curator, false, liveInformation).send({ actorId: 'owner-a', content: 'Como está o tempo em Curitiba?' })
    expect(curator.capture).not.toHaveBeenCalled()
    expect(handle).toHaveBeenCalledWith(expect.objectContaining({ liveInformation: [expect.objectContaining({ capability: 'weather', retention: 'ephemeral' })] }))
    expect(result.memory).toEqual({ action: 'discard', reason: 'live_information_ephemeral' })
  })

  it('uses deterministic safe failure when live information is unavailable', async () => {
    const store = new MemoryChatStore()
    const handle = vi.fn()
    const curator = { capture: vi.fn() }
    const liveInformation = { resolve: vi.fn().mockResolvedValue({ status: 'unavailable', message: 'A fonte não respondeu; não vou estimar dados.' }) }
    const result = await new ChatService(store, { handle }, curator, false, liveInformation).send({ actorId: 'owner-a', content: 'Vai chover em Recife?' })
    expect(result.assistantMessage.content).toContain('não vou estimar')
    expect(result.provider).toBe('pegasus-live-information')
    expect(handle).not.toHaveBeenCalled()
    expect(curator.capture).not.toHaveBeenCalled()
  })

  it('resolves “lembre disso” from the preceding owner message', async () => {
    const store = new MemoryChatStore()
    const conversation = await store.createConversation('owner-a', 'Projeto')
    await store.createMessage({ ownerId: 'owner-a', conversationId: conversation.id, role: 'user', content: 'O projeto usa Supabase.', correlationId: 'previous' })
    const curator = { capture: vi.fn().mockResolvedValue({ action: 'persist', memory: { id: 'memory-1' } }) }
    await new ChatService(store, createChatCore(), curator).send({ actorId: 'owner-a', conversationId: conversation.id, content: 'Pegasus, lembre disso para mim.' })
    expect(curator.capture).toHaveBeenCalledWith(expect.objectContaining({ content: 'Pegasus, lembre disso para mim.', referenceContent: 'O projeto usa Supabase.', referenceSource: { kind: 'user_message', ref: expect.stringMatching(/^message:/) } }))
  })
})
