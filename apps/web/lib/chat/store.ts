import 'server-only'

import { AppError } from '@pegasus/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatAttachment, ChatConversation, ChatMessage, ChatStore } from './types'
import type { ConversationWorkingContext } from '@pegasus/core'

type ConversationRow = { id: string; title: string | null; updated_at: string }
type ConversationMetadataRow = { metadata: Record<string, unknown> | null }
type MessageRow = { id: string; conversation_id: string; role: string; content: string | null; created_at: string; metadata: { correlation_id?: string; attachments?: ChatAttachment[]; live_information?: ChatMessage['liveInformation'] } | null }

const toConversation = (row: ConversationRow): ChatConversation => ({ id: row.id, title: row.title, updatedAt: row.updated_at })
const toMessage = (row: MessageRow): ChatMessage => ({ id: row.id, conversationId: row.conversation_id, role: row.role === 'assistant' ? 'assistant' : 'user', content: row.content ?? '', createdAt: row.created_at, correlationId: row.metadata?.correlation_id, attachments: row.metadata?.attachments, liveInformation: row.metadata?.live_information })

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

  async getWorkingContext(ownerId: string, conversationId: string) {
    const { data, error } = await this.client.from('conversations').select('metadata').eq('owner_id', ownerId).eq('id', conversationId).maybeSingle()
    if (error) throw new AppError('CHAT_READ_FAILED', 'Não foi possível carregar o contexto da conversa.', 503)
    const value = (data as ConversationMetadataRow | null)?.metadata?.conversation_working_context
    return value && typeof value === 'object' ? value as ConversationWorkingContext : null
  }

  async saveWorkingContext(ownerId: string, conversationId: string, context: ConversationWorkingContext | null) {
    const { data, error: readError } = await this.client.from('conversations').select('metadata').eq('owner_id', ownerId).eq('id', conversationId).maybeSingle()
    if (readError || !data) throw new AppError('CHAT_CONTEXT_UPDATE_FAILED', 'Não foi possível atualizar o contexto da conversa.', 503)
    const metadata = { ...((data as ConversationMetadataRow).metadata ?? {}) }
    if (context) metadata.conversation_working_context = context
    else delete metadata.conversation_working_context
    const { error } = await this.client.from('conversations').update({ metadata }).eq('owner_id', ownerId).eq('id', conversationId)
    if (error) throw new AppError('CHAT_CONTEXT_UPDATE_FAILED', 'Não foi possível atualizar o contexto da conversa.', 503)
  }

  async createMessage(input: { ownerId: string; conversationId: string; role: 'user' | 'assistant'; content: string; correlationId: string; provider?: string; model?: string; attachments?: ChatAttachment[]; liveInformation?: ChatMessage['liveInformation'] }) {
    const conversation = await this.getConversation(input.ownerId, input.conversationId)
    if (!conversation) throw new AppError('CONVERSATION_NOT_FOUND', 'Conversa não encontrada.', 404)
    const { data, error } = await this.client.from('messages').insert({ owner_id: input.ownerId, conversation_id: input.conversationId, role: input.role, content: input.content, content_classification: 'internal', model_provider: input.provider, model_name: input.model, metadata: { correlation_id: input.correlationId, attachments: input.attachments, live_information: input.liveInformation, model_output_trust: input.role === 'assistant' ? 'untrusted' : undefined } }).select('id, conversation_id, role, content, created_at, metadata').single()
    if (error) throw new AppError('MESSAGE_CREATE_FAILED', 'Não foi possível registrar a mensagem.', 503)
    await this.client.from('conversations').update({ updated_at: new Date().toISOString() }).eq('owner_id', input.ownerId).eq('id', input.conversationId)
    return toMessage(data as MessageRow)
  }
}
