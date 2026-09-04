import 'server-only'

import { AiRouter, AiRouterError, FakeAiProvider, PegasusCore } from '@pegasus/core'
import type { ContextPort, InteractionRequest, RouterConfig, RouterObserver } from '@pegasus/core'
import { logger } from '@pegasus/logging'
import { AppError } from '@pegasus/shared'
import type { ChatStore, SendChatInput, SendChatResult } from './types'

const fakeModel = {
  provider: 'pegasus-fake', model: 'local-safe-v1', enabled: true,
  capabilities: ['balanced'] as const, modalities: ['text'] as const,
  quality: 3, latency: 1, priority: 1, requiresCredential: false,
}

const routerConfig: RouterConfig = {
  models: [fakeModel], timeoutMs: 15_000, retriesPerModel: 0,
  fallback: { enabled: false, maxModels: 1, allowPaid: false },
}

export function createChatCore(responseText = 'Recebi sua mensagem. O Pegasus está operando em modo local seguro, sem consumo de API paga.') {
  const observer: RouterObserver = { record(trace) { logger.info('chat.ai_route', { correlationId: trace.correlationId, durationMs: trace.durationMs, provider: trace.provider, model: trace.model, status: trace.status, usage: trace.usage, estimatedCostUsd: trace.estimatedCostUsd, fallback: trace.fallback, error: trace.error }) } }
  const context: ContextPort = { async assemble(request) { return { id: `context-${request.id}`, items: [] } } }
  return new PegasusCore(new AiRouter(routerConfig, [new FakeAiProvider('pegasus-fake', { type: 'success', content: responseText, usage: { inputUnits: 0, outputUnits: 0, totalUnits: 0, unit: 'tokens' } })], observer), context)
}

function titleFrom(content: string) {
  const compact = content.replace(/\s+/g, ' ').trim()
  return compact.length > 56 ? `${compact.slice(0, 53)}...` : compact
}

export class ChatService {
  constructor(private readonly store: ChatStore, private readonly core: Pick<PegasusCore, 'handle'> = createChatCore()) {}

  async send(input: SendChatInput): Promise<SendChatResult> {
    const content = input.content.trim()
    if (!content) throw new AppError('MESSAGE_EMPTY', 'Digite uma mensagem antes de enviar.', 400)
    if (content.length > 12_000) throw new AppError('MESSAGE_TOO_LARGE', 'A mensagem excede o limite permitido.', 413)
    const correlationId = crypto.randomUUID()
    const conversation = input.conversationId
      ? await this.store.getConversation(input.actorId, input.conversationId)
      : await this.store.createConversation(input.actorId, titleFrom(content))
    if (!conversation) throw new AppError('CONVERSATION_NOT_FOUND', 'Conversa não encontrada.', 404)
    const userMessage = await this.store.createMessage({ ownerId: input.actorId, conversationId: conversation.id, role: 'user', content, correlationId })
    const request: InteractionRequest = { id: crypto.randomUUID(), correlationId, actorId: input.actorId, conversationId: conversation.id, input: { modality: 'text', content }, requirements: { capability: 'balanced', quality: 'standard', latency: 'normal' }, execution: { allowPaidModels: false, signal: input.signal } }
    try {
      const result = await this.core.handle(request)
      const assistantMessage = await this.store.createMessage({ ownerId: input.actorId, conversationId: conversation.id, role: 'assistant', content: result.content, correlationId, provider: result.route.provider, model: result.route.model })
      return { conversation, userMessage, assistantMessage, correlationId, provider: result.route.provider, model: result.route.model }
    } catch (error) {
      if (error instanceof AiRouterError && error.detail.code === 'cancelled') throw new AppError('GENERATION_CANCELLED', 'Geração cancelada.', 499)
      if (error instanceof AiRouterError && error.detail.code === 'timeout') throw new AppError('GENERATION_TIMEOUT', 'O tempo de resposta foi excedido. Tente novamente.', 504)
      if (error instanceof DOMException && error.name === 'AbortError') throw new AppError('GENERATION_CANCELLED', 'Geração cancelada.', 499)
      logger.warn('chat.generation_failed', { correlationId, errorCode: error instanceof Error ? error.name : 'unknown' })
      throw new AppError('GENERATION_FAILED', 'O Pegasus não conseguiu responder agora. Tente novamente.', 503)
    }
  }
}
