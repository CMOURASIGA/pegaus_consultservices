import { describe, expect, it, vi } from 'vitest'
import { AiRouterError, CapabilityRegistry, CapabilityRouter } from '@pegasus/core'
import type { CapabilityDescriptor, CapabilityProviderPort, ConversationWorkingContext, LiveInformationEvidence } from '@pegasus/core'
import { AppError } from '@pegasus/shared'
import { ChatService, createChatCore } from './service'
import type { ChatAttachment, ChatConversation, ChatMessage, ChatStore } from './types'

class MemoryChatStore implements ChatStore {
  conversations: Array<ChatConversation & { ownerId: string }> = []
  messages: Array<ChatMessage & { ownerId: string; provider?: string; model?: string }> = []
  workingContexts = new Map<string, ConversationWorkingContext>()
  async listConversations(ownerId: string) { return this.conversations.filter((item) => item.ownerId === ownerId) }
  async getConversation(ownerId: string, id: string) { return this.conversations.find((item) => item.ownerId === ownerId && item.id === id) ?? null }
  async listMessages(ownerId: string, conversationId: string) { return this.messages.filter((item) => item.ownerId === ownerId && item.conversationId === conversationId) }
  async createConversation(ownerId: string, title: string) {
    const item = { id: crypto.randomUUID(), ownerId, title, updatedAt: new Date().toISOString() }
    this.conversations.push(item); return item
  }
  async getWorkingContext(ownerId: string, conversationId: string) {
    if (!await this.getConversation(ownerId, conversationId)) return null
    return this.workingContexts.get(`${ownerId}:${conversationId}`) ?? null
  }
  async saveWorkingContext(ownerId: string, conversationId: string, context: ConversationWorkingContext | null) {
    const key = `${ownerId}:${conversationId}`
    if (context) this.workingContexts.set(key, context)
    else this.workingContexts.delete(key)
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
    const liveInformation = { route: vi.fn().mockResolvedValue({ status: 'available', capability: { id: 'weather' }, resolvedInput: { location: 'Curitiba', date: 'current' }, evidence: [{ capability: 'weather', provider: 'test-weather', sourceName: 'Test Weather', sourceUrl: 'https://weather.test/forecast', observedAt: '2026-09-17T09:00:00Z', retrievedAt: '2026-09-17T09:01:00Z', validUntil: '2026-09-17T09:31:00Z', value: '18 °C', trust: 'untrusted_external', retention: 'ephemeral' }] }) }
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
    const liveInformation = { route: vi.fn().mockResolvedValue({ status: 'unavailable', message: 'A fonte não respondeu; não vou estimar dados.' }) }
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

  it('preserves pending capability and parameters through the real multi-turn Chat service path', async () => {
    const store = new MemoryChatStore()
    const descriptor: CapabilityDescriptor = { id: 'live.weather', description: 'Previsão meteorológica por local e data.', category: 'live_information', inputSchema: { type: 'object', required: ['location', 'date'] }, outputSchema: { type: 'array' }, provider: 'weather-test', freshnessTtlMs: 1_800_000, readOnly: true, approval: 'none', audit: { eventPrefix: 'weather' } }
    const evidence: LiveInformationEvidence[] = [{ capability: 'live.weather', provider: 'weather-test', sourceName: 'Weather Test', sourceUrl: 'https://weather.test', observedAt: '2026-09-17T12:00:00Z', retrievedAt: '2026-09-17T12:01:00Z', validUntil: '2026-09-18T13:00:00Z', value: 'Previsão confirmada.', trust: 'untrusted_external', retention: 'ephemeral' }]
    const provider: CapabilityProviderPort = { id: 'weather-test', health: async () => 'available', execute: vi.fn().mockResolvedValue(evidence) }
    const selector = { select: vi.fn()
      .mockResolvedValueOnce({ status: 'needs_input', capabilityId: 'live.weather', intent: 'consultar previsão', knownParameters: { date: 'tomorrow' }, missingParameters: ['location'], message: 'Para qual cidade?' })
      .mockResolvedValueOnce({ status: 'selected', capabilityId: 'live.weather', input: { location: 'Rio de Janeiro', date: 'tomorrow' } })
      .mockResolvedValueOnce({ status: 'selected', capabilityId: 'live.weather', input: { location: 'Rio de Janeiro', date: '2026-09-19' } })
      .mockResolvedValueOnce({ status: 'selected', capabilityId: 'live.weather', input: { location: 'Niterói', date: '2026-09-19' } }) }
    const router = new CapabilityRouter(new CapabilityRegistry().register({ descriptor, provider, validateInput: (input) => Boolean(input && typeof input === 'object' && 'location' in input && 'date' in input), validateOutput: () => true }), selector)
    const core = { handle: vi.fn().mockResolvedValue({ content: 'Resposta com fonte e freshness.', route: { provider: 'test-model', model: 'test' } }) }
    const curator = { capture: vi.fn() }
    const service = new ChatService(store, core, curator, false, router)

    const first = await service.send({ actorId: 'owner-a', content: 'Qual é a previsão do tempo amanhã?', timeZone: 'America/Sao_Paulo' })
    expect(first.assistantMessage.content).toBe('Para qual cidade?')
    const second = await service.send({ actorId: 'owner-a', conversationId: first.conversation.id, content: 'Rio de Janeiro.', timeZone: 'America/Sao_Paulo' })
    const third = await service.send({ actorId: 'owner-a', conversationId: first.conversation.id, content: 'E sábado?', timeZone: 'America/Sao_Paulo' })
    const fourth = await service.send({ actorId: 'owner-a', conversationId: first.conversation.id, content: 'E em Niterói?', timeZone: 'America/Sao_Paulo' })

    expect([first, second, third, fourth].map((result) => result.conversation.id)).toEqual([first.conversation.id, first.conversation.id, first.conversation.id, first.conversation.id])
    expect(selector.select.mock.calls[1]?.[0].workingContext.pending).toMatchObject({ conversationId: first.conversation.id, knownParameters: { date: 'tomorrow' }, missingParameters: ['location'] })
    expect(selector.select.mock.calls[2]?.[0].workingContext.activeCapability).toMatchObject({ knownParameters: { location: 'Rio de Janeiro', date: 'tomorrow' } })
    expect(selector.select.mock.calls[3]?.[0].workingContext.activeCapability).toMatchObject({ knownParameters: { location: 'Rio de Janeiro', date: '2026-09-19' } })
    expect(provider.execute).toHaveBeenNthCalledWith(3, { location: 'Niterói', date: '2026-09-19' }, expect.objectContaining({ correlationId: expect.any(String) }))
    expect(curator.capture).not.toHaveBeenCalled()

    const fresh = await new ChatService(store, core).send({ actorId: 'owner-a', content: 'Nova conversa sem contexto anterior.' })
    expect(fresh.conversation.id).not.toBe(first.conversation.id)
    expect(store.workingContexts.has(`owner-a:${fresh.conversation.id}`)).toBe(false)
  })

  it('routes a complete Weather request in one turn without pending state', async () => {
    const store = new MemoryChatStore()
    const router = { route: vi.fn().mockResolvedValue({ status: 'available', capability: { id: 'live.weather' }, resolvedInput: { location: 'Rio de Janeiro', date: 'tomorrow' }, evidence: [{ capability: 'live.weather', provider: 'weather-test', sourceName: 'Weather Test', sourceUrl: 'https://weather.test', observedAt: '2026-09-17T12:00:00Z', retrievedAt: '2026-09-17T12:01:00Z', validUntil: '2026-09-17T13:00:00Z', value: 'Previsão.', trust: 'untrusted_external', retention: 'ephemeral' }] }) }
    const result = await new ChatService(store, { handle: async () => ({ requestId: 'req', correlationId: 'corr', content: 'Previsão com fonte.', modelOutputTrust: 'untrusted' as const, executionAuthorization: 'none' as const, route: { provider: 'test', model: 'test', latencyMs: 1, fallbackUsed: false } }) }, undefined, false, router as never).send({ actorId: 'owner-a', content: 'Qual é a previsão do tempo amanhã no Rio de Janeiro?', timeZone: 'America/Sao_Paulo' })
    expect(result.assistantMessage.content).toBe('Previsão com fonte.')
    expect(store.workingContexts.get(`owner-a:${result.conversation.id}`)?.activeCapability?.knownParameters).toEqual({ location: 'Rio de Janeiro', date: 'tomorrow' })
  })
})
