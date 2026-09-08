import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { GoogleDriveDocumentSource } from './google-drive'

describe('GoogleDriveDocumentSource', () => {
  it('uses a server token to read metadata and content without returning it', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'file-1', name: 'Plano.md', mimeType: 'text/markdown', modifiedTime: '2026-09-08T00:00:00Z', md5Checksum: 'hash', webViewLink: 'https://drive.google.com/file/d/file-1/view' }), { status: 200 }))
      .mockResolvedValueOnce(new Response('Conteúdo autorizado', { status: 200 }))
    const source = new GoogleDriveDocumentSource({ getAccessToken: vi.fn(async () => 'server-token') }, fetcher)
    const result = await source.readAuthorized({ ownerId: 'owner-a', externalRef: 'file-1' })
    expect(result).toMatchObject({ externalRef: 'file-1', title: 'Plano.md', content: 'Conteúdo autorizado', classification: 'internal' })
    expect(JSON.stringify(result)).not.toContain('server-token')
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('file-1'), expect.objectContaining({ headers: { Authorization: 'Bearer server-token' }, cache: 'no-store' }))
  })

  it('fails closed without an authorized token', async () => {
    const source = new GoogleDriveDocumentSource({ getAccessToken: vi.fn(async () => null) }, vi.fn())
    await expect(source.readAuthorized({ ownerId: 'owner-a', externalRef: 'file-1' })).rejects.toMatchObject({ code: 'source_unavailable' })
  })

  it('does not ingest unsupported binary content', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'file-1', name: 'arquivo.bin', mimeType: 'application/octet-stream', modifiedTime: '2026-09-08T00:00:00Z' }), { status: 200 }))
      .mockResolvedValueOnce(new Response('binary', { status: 200 }))
    const source = new GoogleDriveDocumentSource({ getAccessToken: vi.fn(async () => 'server-token') }, fetcher)
    await expect(source.readAuthorized({ ownerId: 'owner-a', externalRef: 'file-1' })).rejects.toMatchObject({ code: 'unsupported_type' })
  })
})
