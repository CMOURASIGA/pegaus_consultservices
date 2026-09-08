import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseMemoryStore } from './store'

const row = { id: 'm1', owner_id: 'owner-a', memory_type: 'semantic', title: null, content: 'Branch develop', scope: 'general', status: 'active', confidence: 1, relevance: 1, authority: 'explicit_user', source_kind: 'conversation', source_ref: 'c1', last_used_at: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }

describe('SupabaseMemoryStore', () => {
  it('creates current memory, initial version and provenance', async () => {
    const inserts: Array<{ table: string; value: unknown }> = []
    const client = { from(table: string) { return { insert(value: unknown) { inserts.push({ table, value }); if (table === 'memories') return { select: () => ({ single: async () => ({ data: row, error: null }) }) }; return Promise.resolve({ error: null }) } } } } as unknown as SupabaseClient
    const result = await new SupabaseMemoryStore(client).create({ ownerId: 'owner-a', type: 'semantic', content: 'Branch develop', scope: 'general', confidence: 1, relevance: 1, authority: 'explicit_user', source: { kind: 'conversation', ref: 'c1' } })
    expect(result).toMatchObject({ id: 'm1', ownerId: 'owner-a', content: 'Branch develop' })
    expect(inserts).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'memory_versions', value: expect.objectContaining({ owner_id: 'owner-a', memory_id: 'm1', version_no: 1 }) }),
      expect.objectContaining({ table: 'memory_sources', value: expect.objectContaining({ owner_id: 'owner-a', memory_id: 'm1', source_ref: 'c1' }) }),
    ]))
  })

  it('writes a new version before updating current state and always filters owner', async () => {
    const calls: Array<{ table: string; operation: string; value?: unknown; column?: string; match?: unknown }> = []
    const chain = (table: string, terminal: () => unknown) => ({
      eq(column: string, match: unknown) { calls.push({ table, operation: 'eq', column, match }); return this },
      order() { return this }, limit() { return this }, select() { return this }, maybeSingle: terminal, single: terminal,
    })
    const client = { from(table: string) { return {
      select() { return chain(table, async () => ({ data: table === 'memories' ? row : { version_no: 1 }, error: null })) },
      insert(value: unknown) { calls.push({ table, operation: 'insert', value }); return Promise.resolve({ error: null }) },
      update(value: unknown) { calls.push({ table, operation: 'update', value }); return chain(table, async () => ({ data: { ...row, content: 'Branch corrigida' }, error: null })) },
      delete() { return chain(table, async () => ({ error: null })) },
    } } } as unknown as SupabaseClient
    const result = await new SupabaseMemoryStore(client).correct({ ownerId: 'owner-a', memoryId: 'm1', content: 'Branch corrigida', reason: 'Correção explícita' })
    expect(result.content).toBe('Branch corrigida')
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'memory_versions', operation: 'insert', value: expect.objectContaining({ version_no: 2, content: 'Branch corrigida' }) }),
      expect.objectContaining({ table: 'memories', operation: 'eq', column: 'owner_id', match: 'owner-a' }),
      expect.objectContaining({ table: 'memory_versions', operation: 'eq', column: 'owner_id', match: 'owner-a' }),
    ]))
    expect(calls.findIndex((item) => item.table === 'memory_versions' && item.operation === 'insert')).toBeLessThan(calls.findIndex((item) => item.table === 'memories' && item.operation === 'update'))
  })
})
