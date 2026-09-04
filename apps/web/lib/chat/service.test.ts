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
})
