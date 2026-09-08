import 'server-only'

import type { MemoryRecord, MemoryRepository, NewMemory } from '@pegasus/core'
import { AppError } from '@pegasus/shared'
import type { SupabaseClient } from '@supabase/supabase-js'

type MemoryRow = {
  id: string; owner_id: string; memory_type: string; title: string | null; content: string; scope: string; status: string
  confidence: number | null; relevance: number | null; authority: string | null; source_kind: string | null; source_ref: string | null
  last_used_at: string | null; created_at: string; updated_at: string
}

const toMemory = (row: MemoryRow): MemoryRecord => ({
  id: row.id, ownerId: row.owner_id, type: row.memory_type as MemoryRecord['type'], title: row.title ?? undefined,
  content: row.content, scope: row.scope, status: row.status as MemoryRecord['status'], confidence: row.confidence ?? 0.5,
  relevance: row.relevance ?? 0.5, authority: row.authority === 'explicit_user' ? 'explicit_user' : 'inferred',
  source: { kind: row.source_kind ?? 'unknown', ref: row.source_ref ?? undefined }, lastUsedAt: row.last_used_at ?? undefined,
  createdAt: row.created_at, updatedAt: row.updated_at,
})

const fields = 'id, owner_id, memory_type, title, content, scope, status, confidence, relevance, authority, source_kind, source_ref, last_used_at, created_at, updated_at'

export class SupabaseMemoryStore implements MemoryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async create(memory: NewMemory) {
    const { data, error } = await this.client.from('memories').insert({
      owner_id: memory.ownerId, memory_type: memory.type, title: memory.title, content: memory.content, scope: memory.scope,
      status: 'active', confidence: memory.confidence, relevance: memory.relevance, authority: memory.authority,
      source_kind: memory.source.kind, source_ref: memory.source.ref,
    }).select(fields).single()
    if (error || !data) throw new AppError('MEMORY_SAVE_FAILED', 'Não foi possível guardar essa memória agora.', 503)

    const [{ error: versionError }, { error: sourceError }] = await Promise.all([
      this.client.from('memory_versions').insert({ owner_id: memory.ownerId, memory_id: data.id, version_no: 1, content: memory.content, change_reason: 'Criação da memória' }),
      this.client.from('memory_sources').insert({ owner_id: memory.ownerId, memory_id: data.id, source_type: memory.source.kind, source_ref: memory.source.ref, authority: memory.authority, confidence: memory.confidence }),
    ])
    if (versionError || sourceError) {
      await this.client.from('memories').delete().eq('owner_id', memory.ownerId).eq('id', data.id)
      throw new AppError('MEMORY_SAVE_FAILED', 'Não foi possível guardar essa memória agora.', 503)
    }
    return toMemory(data as MemoryRow)
  }

  async listActive(ownerId: string, limit: number) {
    const { data, error } = await this.client.from('memories').select(fields).eq('owner_id', ownerId).eq('status', 'active').order('updated_at', { ascending: false }).limit(limit)
    if (error) throw new AppError('MEMORY_READ_FAILED', 'Não foi possível consultar as memórias.', 503)
    return (data as MemoryRow[]).map(toMemory)
  }

  async list(ownerId: string, limit = 100) {
    const { data, error } = await this.client.from('memories').select(fields).eq('owner_id', ownerId).neq('status', 'deleted').order('updated_at', { ascending: false }).limit(limit)
    if (error) throw new AppError('MEMORY_READ_FAILED', 'Não foi possível consultar as memórias.', 503)
    return (data as MemoryRow[]).map(toMemory)
  }

  async correct(input: { ownerId: string; memoryId: string; content: string; reason: string }) {
    const { data: current, error: readError } = await this.client.from('memories').select(fields).eq('owner_id', input.ownerId).eq('id', input.memoryId).eq('status', 'active').maybeSingle()
    if (readError) throw new AppError('MEMORY_READ_FAILED', 'Não foi possível consultar a memória.', 503)
    if (!current) throw new AppError('MEMORY_NOT_FOUND', 'Memória não encontrada ou inativa.', 404)
    const { data: latest, error: versionReadError } = await this.client.from('memory_versions').select('version_no').eq('owner_id', input.ownerId).eq('memory_id', input.memoryId).order('version_no', { ascending: false }).limit(1).maybeSingle()
    if (versionReadError) throw new AppError('MEMORY_UPDATE_FAILED', 'Não foi possível corrigir a memória.', 503)
    const versionNo = (latest?.version_no ?? 0) + 1
    const { error: versionError } = await this.client.from('memory_versions').insert({ owner_id: input.ownerId, memory_id: input.memoryId, version_no: versionNo, content: input.content, change_reason: input.reason })
    if (versionError) throw new AppError('MEMORY_UPDATE_FAILED', 'Não foi possível corrigir a memória.', 503)
    const { data, error } = await this.client.from('memories').update({ content: input.content, authority: 'explicit_user', confidence: 1 }).eq('owner_id', input.ownerId).eq('id', input.memoryId).eq('status', 'active').select(fields).single()
    if (error || !data) {
      await this.client.from('memory_versions').delete().eq('owner_id', input.ownerId).eq('memory_id', input.memoryId).eq('version_no', versionNo)
      throw new AppError('MEMORY_UPDATE_FAILED', 'Não foi possível corrigir a memória.', 503)
    }
    return toMemory(data as MemoryRow)
  }

  async archive(ownerId: string, memoryId: string) {
    const { data, error } = await this.client.from('memories').update({ status: 'archived' }).eq('owner_id', ownerId).eq('id', memoryId).eq('status', 'active').select('id').maybeSingle()
    if (error) throw new AppError('MEMORY_UPDATE_FAILED', 'Não foi possível arquivar a memória.', 503)
    if (!data) throw new AppError('MEMORY_NOT_FOUND', 'Memória não encontrada ou inativa.', 404)
  }

  async markUsed(ownerId: string, memoryIds: readonly string[]) {
    if (!memoryIds.length) return
    await this.client.from('memories').update({ last_used_at: new Date().toISOString() }).eq('owner_id', ownerId).in('id', [...memoryIds])
  }
}
