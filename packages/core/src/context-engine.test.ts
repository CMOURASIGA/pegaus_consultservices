import { describe, expect, it, vi } from 'vitest'
import { ContextEngine } from './context-engine'
import type { InteractionRequest } from './contracts'
import type { MemoryRecord, MemoryRepository, NewMemory } from './memory'

const base = (overrides: Partial<MemoryRecord>): MemoryRecord => ({ id: 'm', ownerId: 'owner', type: 'semantic', content: 'vazio', scope: 'general', status: 'active', confidence: 0.8, relevance: 0.8, authority: 'explicit_user', source: { kind: 'conversation', ref: 'c1' }, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...overrides })
const request = (content: string): InteractionRequest => ({ id: 'r1', correlationId: 'corr', actorId: 'owner', input: { modality: 'text', content }, requirements: { capability: 'balanced' } })

class Repository implements MemoryRepository {
  constructor(readonly records: MemoryRecord[]) {}
  create(memory: NewMemory): Promise<MemoryRecord> { void memory; throw new Error('unused') }
  async listActive(ownerId: string, limit: number) { return this.records.filter((item) => item.ownerId === ownerId).slice(0, limit) }
  correct(): Promise<MemoryRecord> { throw new Error('unused') }
  async archive() {}
  markUsed = vi.fn(async () => undefined)
}

describe('ContextEngine', () => {
  it('retrieves only relevant active owner memories with provenance', async () => {
    const repository = new Repository([
      base({ id: 'project', content: 'O projeto Pegasus usa a branch develop' }),
      base({ id: 'food', content: 'Christian gosta de café', type: 'working_profile' }),
      base({ id: 'old', content: 'O projeto Pegasus usava main', status: 'superseded' }),
      base({ id: 'other-owner', ownerId: 'other', content: 'Projeto Pegasus secreto' }),
    ])
    const context = await new ContextEngine(repository).assemble(request('Qual branch usamos no projeto Pegasus?'))
    expect(context.items).toEqual([{ source: 'memory:project:conversation', classification: 'internal', value: 'O projeto Pegasus usa a branch develop' }])
    expect(repository.markUsed).toHaveBeenCalledWith('owner', ['project'])
  })

  it('enforces item and character budgets deterministically', async () => {
    const repository = new Repository([
      base({ id: 'a', content: 'Pegasus projeto ' + 'a'.repeat(20), relevance: 1 }),
      base({ id: 'b', content: 'Pegasus projeto ' + 'b'.repeat(20), relevance: 0.9 }),
      base({ id: 'c', content: 'Pegasus projeto ' + 'c'.repeat(20), relevance: 0.8 }),
    ])
    const observer = { record: vi.fn(async () => undefined) }
    const context = await new ContextEngine(repository, { maxItems: 1, maxCharacters: 40, maxItemCharacters: 40 }, observer).assemble(request('projeto Pegasus'))
    expect(context.items).toHaveLength(1)
    expect(observer.record).toHaveBeenCalledWith(expect.objectContaining({ candidates: 3, selected: 1, truncated: true, sources: { memory: 1 } }))
    expect(JSON.stringify(observer.record.mock.calls)).not.toContain('aaaa')
  })

  it('never sends a secret-shaped memory to model context', async () => {
    const repository = new Repository([base({ id: 'secret', content: 'api_key=valor-privado para projeto Pegasus' })])
    expect((await new ContextEngine(repository).assemble(request('projeto Pegasus'))).items).toEqual([])
  })

  it('adds relevant document chunks as explicitly untrusted context', async () => {
    const knowledge = { retrieve: vi.fn(async () => [{ id: 'chunk-1', documentId: 'doc-1', title: 'Plano', content: 'O cronograma do Pegasus está no Drive.', classification: 'internal' as const, trust: 'untrusted_external' as const }]) }
    const observer = { record: vi.fn() }
    const context = await new ContextEngine(new Repository([]), { maxItems: 3, maxCharacters: 500, maxItemCharacters: 200 }, observer, knowledge).assemble(request('cronograma Pegasus'))
    expect(context.items).toEqual([{ source: 'document:doc-1:chunk:chunk-1:untrusted_external', classification: 'internal', value: 'O cronograma do Pegasus está no Drive.' }])
    expect(observer.record).toHaveBeenCalledWith(expect.objectContaining({ sources: { document: 1 } }))
  })
})
