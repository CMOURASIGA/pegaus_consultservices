import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { uploadChatAttachments } from './attachments'

function fakeClient() {
  const uploaded: string[] = []
  const removed: string[][] = []
  const inserted: Array<Record<string, unknown>> = []
  const client = {
    storage: { from: () => ({
      upload: vi.fn(async (path: string) => { uploaded.push(path); return { error: null } }),
      remove: vi.fn(async (paths: string[]) => { removed.push(paths); return { error: null } }),
    }) },
    from: () => ({ insert: (row: Record<string, unknown>) => {
      inserted.push(row)
      return { select: () => ({ single: async () => ({ data: { id: 'document-1' }, error: null }) }) }
    } }),
  }
  return { client: client as unknown as SupabaseClient, uploaded, removed, inserted }
}

describe('uploadChatAttachments', () => {
  it('stores validated content in the private owner path with untrusted provenance', async () => {
    const state = fakeClient()
    const png = new File([new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])], '../foto pessoal.png', { type: 'image/png' })
    const result = await uploadChatAttachments(state.client, 'owner-a', [png])
    expect(state.uploaded[0]).toMatch(/^owner-a\/chat\/[0-9a-f-]+-foto-pessoal\.png$/)
    expect(state.inserted[0]).toMatchObject({ owner_id: 'owner-a', storage_bucket: 'pegasus-private', classification: 'internal', indexing_status: 'excluded', metadata: { source: 'chat', external_content_trust: 'untrusted' } })
    expect(result).toEqual([{ id: 'document-1', name: '../foto pessoal.png', mediaType: 'image/png', size: 8, classification: 'internal' }])
  })

  it('rejects spoofed content before storage', async () => {
    const state = fakeClient()
    const spoofed = new File(['not a PDF'], 'arquivo.pdf', { type: 'application/pdf' })
    await expect(uploadChatAttachments(state.client, 'owner-a', [spoofed])).rejects.toMatchObject({ code: 'ATTACHMENT_CONTENT_INVALID', status: 400 })
    expect(state.uploaded).toHaveLength(0)
    expect(state.inserted).toHaveLength(0)
  })
})
