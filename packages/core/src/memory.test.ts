import { describe, expect, it } from 'vitest'
import { MemoryCurator, MemoryPolicyError, type MemoryRecord, type MemoryRepository, type NewMemory } from './memory'

class InMemoryRepository implements MemoryRepository {
  records: MemoryRecord[] = []
  versions: { memoryId: string; content: string; reason?: string }[] = []
  async create(input: NewMemory) {
    const now = new Date().toISOString()
    const record: MemoryRecord = { ...input, id: `memory-${this.records.length + 1}`, status: 'active', createdAt: now, updatedAt: now }
    this.records.push(record); return record
  }
  async listActive(ownerId: string, limit: number) { return this.records.filter((item) => item.ownerId === ownerId && item.status === 'active').slice(0, limit) }
  async findActiveByTitle(ownerId: string, title: string) { return this.records.find((item) => item.ownerId === ownerId && item.title === title && item.status === 'active') ?? null }
  async correct(input: { ownerId: string; memoryId: string; content: string; reason: string; source?: { kind: string; ref?: string } }) {
    const current = this.records.find((item) => item.id === input.memoryId && item.ownerId === input.ownerId)
    if (!current) throw new Error('not_found')
    this.versions.push({ memoryId: current.id, content: current.content, reason: input.reason })
    current.content = input.content; current.authority = 'explicit_user'; current.confidence = 1; current.status = 'active'; current.source = input.source ?? current.source; current.updatedAt = new Date().toISOString(); return current
  }
  async archive(ownerId: string, memoryId: string) { const item = this.records.find((record) => record.ownerId === ownerId && record.id === memoryId); if (item) item.status = 'archived' }
}

describe('MemoryCurator', () => {
  it('honors an explicit instruction and removes the command wrapper', async () => {
    const repository = new InMemoryRepository()
    const result = await new MemoryCurator(repository).capture({ ownerId: 'christian', content: 'Lembre que prefiro revisar a SPEC antes do código', source: { kind: 'conversation', ref: 'c1' } })
    expect(result).toMatchObject({ action: 'persist', memory: { content: 'prefiro revisar a SPEC antes do código', authority: 'explicit_user', confidence: 1, relevance: 1, source: { ref: 'c1' } } })
  })

  it('resolves an explicit deictic memory request only from supplied conversation context', async () => {
    const repository = new InMemoryRepository()
    const result = await new MemoryCurator(repository).capture({ ownerId: 'christian', content: 'Pegasus, lembre disso para mim.', referenceContent: 'Meu projeto usa a branch develop.', source: { kind: 'conversation', ref: 'c1' } })
    expect(result).toMatchObject({ action: 'persist', memory: { content: 'Meu projeto usa a branch develop.', authority: 'explicit_user' } })
    expect(new MemoryCurator(repository).evaluate({ ownerId: 'christian', content: 'Lembre disso.', source: { kind: 'conversation' } })).toEqual({ action: 'discard', reason: 'irrelevant' })
  })

  it('does not turn ordinary conversation into permanent memory', () => {
    const decision = new MemoryCurator(new InMemoryRepository()).evaluate({ ownerId: 'christian', content: 'Olá, tudo bem?', source: { kind: 'conversation' } })
    expect(decision).toEqual({ action: 'discard', reason: 'irrelevant' })
  })

  it('marks a reusable inferred preference with lower authority', () => {
    const decision = new MemoryCurator(new InMemoryRepository()).evaluate({ ownerId: 'christian', content: 'Eu prefiro respostas objetivas', source: { kind: 'conversation' } })
    expect(decision).toMatchObject({ action: 'persist', memory: { type: 'working_profile', authority: 'inferred', confidence: 0.65 } })
  })

  it('captures useful implicit personal, project and working-style facts', () => {
    const curator = new MemoryCurator(new InMemoryRepository())
    expect(curator.evaluate({ ownerId: 'christian', content: 'Minha esposa se chama Bianca.', source: { kind: 'conversation', ref: 'c1' } })).toMatchObject({ action: 'persist', memory: { type: 'relationship', title: 'relationship:spouse', scope: 'personal' } })
    expect(curator.evaluate({ ownerId: 'christian', content: 'Estou desenvolvendo um sistema chamado 7Grafica para administrar uma gráfica.', source: { kind: 'conversation', ref: 'c1' } })).toMatchObject({ action: 'persist', memory: { type: 'project', title: 'project:7grafica', scope: 'professional' } })
    expect(curator.evaluate({ ownerId: 'christian', content: 'Quando desenvolvermos meus sistemas, quero que você me avise se eu tomar uma decisão ruim.', source: { kind: 'conversation', ref: 'c1' } })).toMatchObject({ action: 'persist', memory: { type: 'working_profile', title: 'preference:product-development', scope: 'professional' } })
  })

  it('updates a stable fact instead of creating a conflicting duplicate', async () => {
    const repository = new InMemoryRepository()
    const curator = new MemoryCurator(repository)
    await curator.capture({ ownerId: 'christian', content: 'Minha esposa se chama Bianca.', source: { kind: 'conversation', ref: 'c1' } })
    const result = await curator.capture({ ownerId: 'christian', content: 'Minha esposa se chama Beatriz.', source: { kind: 'conversation', ref: 'c2' } })
    expect(result).toMatchObject({ action: 'persist', operation: 'updated', memory: { content: 'Minha esposa se chama Beatriz.' } })
    expect(repository.records).toHaveLength(1)
    expect(repository.versions).toEqual([expect.objectContaining({ memoryId: 'memory-1', content: 'Minha esposa se chama Bianca.' })])
  })

  it('does not merge or update another owner memory', async () => {
    const repository = new InMemoryRepository()
    const curator = new MemoryCurator(repository)
    await curator.capture({ ownerId: 'owner-a', content: 'Minha esposa se chama Ana.', source: { kind: 'conversation' } })
    await curator.capture({ ownerId: 'owner-b', content: 'Minha esposa se chama Bia.', source: { kind: 'conversation' } })
    expect(repository.records).toHaveLength(2)
  })

  it('rejects sensitive implicit facts and exact duplicates', async () => {
    const repository = new InMemoryRepository()
    const curator = new MemoryCurator(repository)
    expect(curator.evaluate({ ownerId: 'christian', content: 'Meu CPF é 000.000.000-00', source: { kind: 'conversation' } })).toEqual({ action: 'discard', reason: 'irrelevant' })
    await curator.capture({ ownerId: 'christian', content: 'Minha esposa se chama Bianca.', source: { kind: 'conversation' } })
    await expect(curator.capture({ ownerId: 'christian', content: 'Minha esposa se chama Bianca.', source: { kind: 'conversation' } })).resolves.toEqual({ action: 'discard', reason: 'duplicate' })
  })

  it('rejects credential-like content even when explicitly requested', async () => {
    const curator = new MemoryCurator(new InMemoryRepository())
    expect(curator.evaluate({ ownerId: 'christian', content: 'Lembre que api_key=valor-privado', source: { kind: 'conversation' } })).toEqual({ action: 'discard', reason: 'sensitive' })
    await expect(curator.correct({ ownerId: 'christian', memoryId: 'm1', content: 'token=eyJabcdefghijklmnopqrstuvwxyz.abcdefghijk' })).rejects.toBeInstanceOf(MemoryPolicyError)
  })
})
