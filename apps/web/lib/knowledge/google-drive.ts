import 'server-only'

import { KnowledgeStoreError, type DocumentSourceAdapter, type ExternalDocument } from '@pegasus/core'

export interface GoogleDriveTokenProvider { getAccessToken(ownerId: string): Promise<string | null> }

type DriveMetadata = { id: string; name: string; mimeType: string; modifiedTime: string; version?: string; md5Checksum?: string; webViewLink?: string; trashed?: boolean }

const exportMime: Record<string, string> = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
}

export class GoogleDriveDocumentSource implements DocumentSourceAdapter {
  readonly id = 'google_drive'
  constructor(private readonly tokens: GoogleDriveTokenProvider, private readonly fetcher: typeof fetch = fetch) {}
  async isAvailable() { return true }

  async readAuthorized(input: { ownerId: string; externalRef: string; signal?: AbortSignal }): Promise<ExternalDocument> {
    const token = await this.tokens.getAccessToken(input.ownerId)
    if (!token) throw new KnowledgeStoreError('source_unavailable')
    const headers = { Authorization: `Bearer ${token}` }
    const metadataResponse = await this.fetcher(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.externalRef)}?fields=id,name,mimeType,modifiedTime,version,md5Checksum,webViewLink,trashed`, { headers, signal: input.signal, cache: 'no-store' })
    if (!metadataResponse.ok) throw new KnowledgeStoreError('source_error')
    const metadata = await metadataResponse.json() as DriveMetadata
    if (metadata.trashed) throw new KnowledgeStoreError('source_error')
    const targetMime = exportMime[metadata.mimeType]
    const contentUrl = targetMime
      ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(metadata.id)}/export?mimeType=${encodeURIComponent(targetMime)}`
      : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(metadata.id)}?alt=media`
    const contentResponse = await this.fetcher(contentUrl, { headers, signal: input.signal, cache: 'no-store' })
    if (!contentResponse.ok) throw new KnowledgeStoreError('source_error')
    const mimeType = targetMime ?? metadata.mimeType
    if (!['text/plain', 'text/markdown', 'text/csv'].includes(mimeType)) throw new KnowledgeStoreError('unsupported_type')
    return {
      externalRef: metadata.id, versionRef: metadata.version ?? metadata.md5Checksum ?? metadata.modifiedTime,
      title: metadata.name, mimeType, classification: 'internal', content: await contentResponse.text(),
      modifiedAt: metadata.modifiedTime, sourceUrl: metadata.webViewLink,
    }
  }
}
