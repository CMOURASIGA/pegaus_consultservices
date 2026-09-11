import type { ContextPort, ContextSnapshot, InteractionRequest } from './contracts'
import { containsSecret, memoryQuery, type MemoryRecord, type MemoryRepository } from './memory'

export type ContextBudget = { maxItems: number; maxCharacters: number; maxItemCharacters: number }
export type ContextMetrics = { correlationId: string; candidates: number; selected: number; characters: number; truncated: boolean; sources: Record<string, number>; retrievalDurationMs: number; failedSources?: readonly string[] }
export interface ContextObserver { record(metrics: ContextMetrics): void | Promise<void> }
export interface KnowledgeContextSource {
  retrieve(ownerId: string, query: string, limit?: number): Promise<readonly { id: string; documentId: string; title: string; content: string; classification: 'public' | 'internal' | 'confidential'; trust: 'untrusted_external' }[]>
}
export interface ConversationContextSource {
  retrieve(ownerId: string, conversationId: string, query: string, limit?: number): Promise<readonly { id: string; role: 'user' | 'assistant'; content: string; createdAt: string }[]>
}

const defaultBudget: ContextBudget = { maxItems: 6, maxCharacters: 4_000, maxItemCharacters: 1_000 }
const stopWords = new Set(['a','as','o','os','de','da','das','do','dos','e','em','para','por','que','um','uma','me','eu','com','no','na','nos','nas'])
const aliases: Record<string, readonly string[]> = { esposa: ['mulher', 'conjuge'], marido: ['homem', 'conjuge'], grafica: ['7grafica'], projeto: ['sistema'], sistema: ['projeto'] }

function terms(value: string) {
  const found = value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]{3,}/g)?.filter((term) => !stopWords.has(term)) ?? []
  return new Set(found.flatMap((term) => [term, ...(aliases[term] ?? [])]))
}

function score(memory: MemoryRecord, queryTerms: Set<string>, query: string) {
  const memoryTerms = terms(`${memory.title ?? ''} ${memory.content}`)
  let overlap = 0
  for (const term of queryTerms) if (memoryTerms.has(term)) overlap += 1
  const authority = memory.authority === 'explicit_user' ? 0.25 : 0
  const profile = memory.type === 'working_profile' ? 0.12 : 0
  const professionalProfile = memory.type === 'working_profile' && memory.scope === 'professional' && /\b(?:projeto|sistema|arquitetura|desenvolv|decisão|decidir|implementar)\b/iu.test(query) ? 1.1 : 0
  const provenanceFollowUp = /\b(?:por que você sabe|quando (?:eu )?(?:disse|falei)|de onde você sabe)\b/iu.test(query) && memory.lastUsedAt ? 2.5 : 0
  return overlap * 2 + memory.relevance + memory.confidence + authority + profile + professionalProfile + provenanceFollowUp
}

export class ContextEngine implements ContextPort {
  constructor(private readonly memories: MemoryRepository, private readonly budget: ContextBudget = defaultBudget, private readonly observer?: ContextObserver, private readonly knowledge?: KnowledgeContextSource, private readonly conversation?: ConversationContextSource) {}

  async assemble(request: InteractionRequest): Promise<ContextSnapshot> {
    const startedAt = Date.now()
    const failedSources: string[] = []
    const candidates = await this.memories.listActive(request.actorId, 50).catch(() => { failedSources.push('memory'); return [] as readonly MemoryRecord[] })
    const queryTerms = terms(memoryQuery(request))
    const ranked = candidates
      .filter((memory) => memory.status === 'active' && !containsSecret(memory.content))
      .map((memory) => ({ memory, score: score(memory, queryTerms, request.input.content) }))
      .filter(({ memory, score }) => score >= 3 || (memory.type === 'working_profile' && score >= 2))
      .sort((left, right) => right.score - left.score || Date.parse(right.memory.updatedAt) - Date.parse(left.memory.updatedAt) || left.memory.id.localeCompare(right.memory.id))

    const items: ContextSnapshot['items'][number][] = []
    const usedIds: string[] = []
    let characters = 0
    let truncated = false
    for (const { memory } of ranked) {
      if (items.length >= this.budget.maxItems) { truncated = true; break }
      const value = memory.content.slice(0, this.budget.maxItemCharacters)
      if (characters + value.length > this.budget.maxCharacters) { truncated = true; continue }
      items.push({ source: `memory:${memory.id}:${memory.source.kind}`, classification: 'internal', value, kind: 'memory', trust: 'contextual', provenance: { sourceKind: memory.source.kind, sourceRef: memory.source.ref, recordedAt: memory.createdAt, updatedAt: memory.updatedAt, authority: memory.authority, confidence: memory.confidence } })
      usedIds.push(memory.id)
      characters += value.length
    }
    const history = this.conversation && request.conversationId && items.length < this.budget.maxItems
      ? await this.conversation.retrieve(request.actorId, request.conversationId, request.input.content, this.budget.maxItems - items.length).catch(() => { failedSources.push('history'); return [] as const })
      : []
    for (const message of history) {
      if (items.length >= this.budget.maxItems) { truncated = true; break }
      const value = `${message.role}: ${message.content}`.slice(0, this.budget.maxItemCharacters)
      if (characters + value.length > this.budget.maxCharacters || containsSecret(value)) { truncated = true; continue }
      items.push({ source: `conversation:${request.conversationId}:message:${message.id}`, classification: 'internal', value, kind: 'history', trust: 'contextual' })
      characters += value.length
    }
    const documents = this.knowledge && items.length < this.budget.maxItems
      ? await this.knowledge.retrieve(request.actorId, memoryQuery(request), this.budget.maxItems - items.length).catch(() => { failedSources.push('document'); return [] as const })
      : []
    for (const chunk of documents) {
      if (items.length >= this.budget.maxItems) { truncated = true; break }
      const value = chunk.content.slice(0, this.budget.maxItemCharacters)
      if (characters + value.length > this.budget.maxCharacters) { truncated = true; continue }
      items.push({ source: `document:${chunk.documentId}:chunk:${chunk.id}:untrusted_external`, classification: chunk.classification, value, kind: 'external', trust: 'untrusted_external' })
      characters += value.length
    }
    if (usedIds.length) await this.memories.markUsed?.(request.actorId, usedIds)
    const memoryCount = usedIds.length
    const historyCount = items.filter((item) => item.kind === 'history').length
    const documentCount = items.filter((item) => item.kind === 'external').length
    await this.observer?.record({ correlationId: request.correlationId, candidates: candidates.length + history.length + documents.length, selected: items.length, characters, truncated, sources: { ...(memoryCount ? { memory: memoryCount } : {}), ...(historyCount ? { history: historyCount } : {}), ...(documentCount ? { document: documentCount } : {}) }, retrievalDurationMs: Date.now() - startedAt, ...(failedSources.length ? { failedSources } : {}) })
    return { id: `context-${request.id}`, items }
  }
}
