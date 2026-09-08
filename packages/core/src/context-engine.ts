import type { ContextPort, ContextSnapshot, InteractionRequest } from './contracts'
import { containsSecret, memoryQuery, type MemoryRecord, type MemoryRepository } from './memory'

export type ContextBudget = { maxItems: number; maxCharacters: number; maxItemCharacters: number }
export type ContextMetrics = { correlationId: string; candidates: number; selected: number; characters: number; truncated: boolean; sources: Record<string, number> }
export interface ContextObserver { record(metrics: ContextMetrics): void | Promise<void> }
export interface KnowledgeContextSource {
  retrieve(ownerId: string, query: string, limit?: number): Promise<readonly { id: string; documentId: string; title: string; content: string; classification: 'public' | 'internal' | 'confidential'; trust: 'untrusted_external' }[]>
}

const defaultBudget: ContextBudget = { maxItems: 6, maxCharacters: 4_000, maxItemCharacters: 1_000 }
const stopWords = new Set(['a','as','o','os','de','da','das','do','dos','e','em','para','por','que','um','uma','me','eu','com','no','na','nos','nas'])

function terms(value: string) {
  return new Set(value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]{3,}/g)?.filter((term) => !stopWords.has(term)) ?? [])
}

function score(memory: MemoryRecord, queryTerms: Set<string>) {
  const memoryTerms = terms(memory.content)
  let overlap = 0
  for (const term of queryTerms) if (memoryTerms.has(term)) overlap += 1
  const authority = memory.authority === 'explicit_user' ? 0.25 : 0
  const profile = memory.type === 'working_profile' ? 0.12 : 0
  return overlap * 2 + memory.relevance + memory.confidence + authority + profile
}

export class ContextEngine implements ContextPort {
  constructor(private readonly memories: MemoryRepository, private readonly budget: ContextBudget = defaultBudget, private readonly observer?: ContextObserver, private readonly knowledge?: KnowledgeContextSource) {}

  async assemble(request: InteractionRequest): Promise<ContextSnapshot> {
    const candidates = await this.memories.listActive(request.actorId, 50)
    const queryTerms = terms(memoryQuery(request))
    const ranked = candidates
      .filter((memory) => memory.status === 'active' && !containsSecret(memory.content))
      .map((memory) => ({ memory, score: score(memory, queryTerms) }))
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
      items.push({ source: `memory:${memory.id}:${memory.source.kind}`, classification: 'internal', value })
      usedIds.push(memory.id)
      characters += value.length
    }
    const documents = this.knowledge && items.length < this.budget.maxItems
      ? await this.knowledge.retrieve(request.actorId, memoryQuery(request), this.budget.maxItems - items.length)
      : []
    for (const chunk of documents) {
      if (items.length >= this.budget.maxItems) { truncated = true; break }
      const value = chunk.content.slice(0, this.budget.maxItemCharacters)
      if (characters + value.length > this.budget.maxCharacters) { truncated = true; continue }
      items.push({ source: `document:${chunk.documentId}:chunk:${chunk.id}:untrusted_external`, classification: chunk.classification, value })
      characters += value.length
    }
    if (usedIds.length) await this.memories.markUsed?.(request.actorId, usedIds)
    const memoryCount = usedIds.length
    const documentCount = items.length - memoryCount
    await this.observer?.record({ correlationId: request.correlationId, candidates: candidates.length + documents.length, selected: items.length, characters, truncated, sources: { ...(memoryCount ? { memory: memoryCount } : {}), ...(documentCount ? { document: documentCount } : {}) } })
    return { id: `context-${request.id}`, items }
  }
}
