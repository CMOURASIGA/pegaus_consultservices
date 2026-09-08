import { describe, expect, it } from 'vitest'
import { MemoryCurator, MemoryPolicyError, type MemoryRecord, type MemoryRepository, type NewMemory } from './memory'

class InMemoryRepository implements MemoryRepository {
  records: MemoryRecord[] = []
  async create(input: NewMemory) {
    const now = new Date().toISOString()
    const record: MemoryRecord = { ...input, id: `memory-${this.records.length + 1}`, status: 'active', createdAt: now, updatedAt: now }
    this.records.push(record); return record
  }
  async listActive(ownerId: string, limit: number) { return this.records.filter((item) => item.ownerId === ownerId && item.status === 'active').slice(0, limit) }
  async correct(input: { ownerId: string; memoryId: string; content: string }) {
    const current = this.records.find((item) => item.id === input.memoryId && item.ownerId === input.ownerId)
    if (!current) throw new Error('not_found')
    current.content = input.content; current.authority = 'explicit_user'; current.confidence = 1; current.status = 'active'; current.updatedAt = new Date().toISOString(); return current
  }
  async archive(ownerId: string, memoryId: string) { const item = this.records.find((record) => record.ownerId === ownerId && record.id === memoryId); if (item) item.status = 'archived' }
}

describe('MemoryCurator', () => {
  it('honors an explicit instruction and removes the command wrapper', async () => {
    const repository = new InMemoryRepository()
    const result = await new MemoryCurator(repository).capture({ ownerId: 'christian', content: 'Lembre que prefiro revisar a SPEC antes do código', source: { kind: 'conversation', ref: 'c1' } })
    expect(result).toMatchObject({ action: 'persist', memory: { content: 'prefiro revisar a SPEC antes do código', authority: 'explicit_user', confidence: 1, relevance: 1, source: { ref: 'c1' } } })
  })

  it('does not turn ordinary conversation into permanent memory', () => {
    const decision = new MemoryCurator(new InMemoryRepository()).evaluate({ ownerId: 'christian', content: 'Olá, tudo bem?', source: { kind: 'conversation' } })
    expect(decision).toEqual({ action: 'discard', reason: 'irrelevant' })
  })

  it('marks a reusable inferred preference with lower authority', () => {
    const decision = new MemoryCurator(new InMemoryRepository()).evaluate({ ownerId: 'christian', content: 'Eu prefiro respostas objetivas', source: { kind: 'conversation' } })
    expect(decision).toMatchObject({ action: 'persist', memory: { type: 'working_profile', authority: 'inferred', confidence: 0.65 } })
  })

  it('rejects credential-like content even when explicitly requested', async () => {
    const curator = new MemoryCurator(new InMemoryRepository())
    expect(curator.evaluate({ ownerId: 'christian', content: 'Lembre que api_key=valor-privado', source: { kind: 'conversation' } })).toEqual({ action: 'discard', reason: 'sensitive' })
    await expect(curator.correct({ ownerId: 'christian', memoryId: 'm1', content: 'token=eyJabcdefghijklmnopqrstuvwxyz.abcdefghijk' })).rejects.toBeInstanceOf(MemoryPolicyError)
  })
})
