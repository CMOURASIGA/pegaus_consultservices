import 'server-only'

import type { ConversationContextSource } from '@pegasus/core'
import { AppError } from '@pegasus/shared'
import type { SupabaseClient } from '@supabase/supabase-js'

type Row = { id: string; role: string; content: string | null; created_at: string }

const stopWords = new Set(['a','as','o','os','de','da','das','do','dos','e','em','para','por','que','um','uma','me','eu','com','no','na'])
const terms = (value: string) => new Set(value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]{3,}/g)?.filter((term) => !stopWords.has(term)) ?? [])

export class SupabaseConversationContextSource implements ConversationContextSource {
  constructor(private readonly client: SupabaseClient) {}

  async retrieve(ownerId: string, conversationId: string, query: string, limit = 4) {
    const { data, error } = await this.client.from('messages').select('id, role, content, created_at').eq('owner_id', ownerId).eq('conversation_id', conversationId).in('role', ['user', 'assistant']).order('created_at', { ascending: false }).limit(16)
    if (error) throw new AppError('CHAT_READ_FAILED', 'Não foi possível recuperar o contexto da conversa.', 503)
    const queryTerms = terms(query)
    const continuation = /\b(?:isso|essa|esse|anterior|continu|então|porque|por que|lembra)\b/iu.test(query)
    return (data as Row[])
      .filter((row) => Boolean(row.content) && row.content!.trim() !== query.trim())
      .map((row, index) => ({ row, score: [...terms(row.content ?? '')].filter((term) => queryTerms.has(term)).length * 2 + (continuation ? Math.max(0, 1 - index * 0.1) : 0) + (row.role === 'user' ? 1.5 : 0) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || Date.parse(b.row.created_at) - Date.parse(a.row.created_at))
      .slice(0, Math.max(0, Math.min(limit, 6)))
      .sort((a, b) => Date.parse(a.row.created_at) - Date.parse(b.row.created_at))
      .map(({ row }) => ({ id: row.id, role: row.role === 'assistant' ? 'assistant' as const : 'user' as const, content: row.content ?? '', createdAt: row.created_at }))
  }
}
