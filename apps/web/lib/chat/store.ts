import 'server-only'

import { AppError } from '@pegasus/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatConversation, ChatMessage, ChatStore } from './types'

type ConversationRow = { id: string; title: string | null; updated_at: string }
type MessageRow = { id: string; conversation_id: string; role: string; content: string | null; created_at: string; metadata: { correlation_id?: string } | null }

const toConversation = (row: ConversationRow): ChatConversation => ({ id: row.id, title: row.title, updatedAt: row.updated_at })
const toMessage = (row: MessageRow): ChatMessage => ({ id: row.id, conversationId: row.conversation_id, role: row.role === 'assistant' ? 'assistant' : 'user', content: row.content ?? '', createdAt: row.created_at, correlationId: row.metadata?.correlation_id })

export class SupabaseChatStore implements ChatStore {
  constructor(private readonly client: SupabaseClient) {}

  async listConversations(ownerId: string) {
    const { data, error } = await this.client.from('conversations').select('id, title, updated_at').eq('owner_id', ownerId).eq('status', 'active').order('updated_at', { ascending: false }).limit(30)
    if (error) throw new AppError('CHAT_READ_FAILED', 'Não foi possível carregar as conversas.', 503)
    return (data as ConversationRow[]).map(toConversation)
  }

  async getConversation(ownerId: string, conversationId: string) {
    const { data, error } = await this.client.from('conversations').select('id, title, updated_at').eq('owner_id', ownerId).eq('id', conversationId).maybeSingle()
    if (error) throw new AppError('CHAT_READ_FAILED', 'Não foi possível carregar a conversa.', 503)
    return data ? toConversation(data as ConversationRow) : null
  }

  async listMessages(ownerId: string, conversationId: string) {
    const conversation = await this.getConversation(ownerId, conversationId)
    if (!conversation) throw new AppError('CONVERSATION_NOT_FOUND', 'Conversa não encontrada.', 404)
    const { data, error } = await this.client.from('messages').select('id, conversation_id, role, content, created_at, metadata').eq('owner_id', ownerId).eq('conversation_id', conversationId).in('role', ['user', 'assistant']).order('created_at', { ascending: true }).limit(200)
    if (error) throw new AppError('CHAT_READ_FAILED', 'Não foi possível carregar as mensagens.', 503)
    return (data as MessageRow[]).map(toMessage)
  }

  async createConversation(ownerId: string, title: string) {
    const { data, error } = await this.client.from('conversations').insert({ owner_id: ownerId, title, channel: 'web', status: 'active', retention_mode: 'curated', metadata: {} }).select('id, title, updated_at').single()
    if (error) throw new AppError('CONVERSATION_CREATE_FAILED', 'Não foi possível iniciar a conversa.', 503)
    return toConversation(data as ConversationRow)
  }

  async createMessage(input: { ownerId: string; conversationId: string; role: 'user' | 'assistant'; content: string; correlationId: string; provider?: string; model?: string }) {
    const conversation = await this.getConversation(input.ownerId, input.conversationId)
    if (!conversation) throw new AppError('CONVERSATION_NOT_FOUND', 'Conversa não encontrada.', 404)
    const { data, error } = await this.client.from('messages').insert({ owner_id: input.ownerId, conversation_id: input.conversationId, role: input.role, content: input.content, content_classification: 'internal', model_provider: input.provider, model_name: input.model, metadata: { correlation_id: input.correlationId, model_output_trust: input.role === 'assistant' ? 'untrusted' : undefined } }).select('id, conversation_id, role, content, created_at, metadata').single()
    if (error) throw new AppError('MESSAGE_CREATE_FAILED', 'Não foi possível registrar a mensagem.', 503)
    await this.client.from('conversations').update({ updated_at: new Date().toISOString() }).eq('owner_id', input.ownerId).eq('id', input.conversationId)
    return toMessage(data as MessageRow)
  }
}
