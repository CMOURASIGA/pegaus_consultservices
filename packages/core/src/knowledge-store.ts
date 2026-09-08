import { containsSecret } from './memory'

export type DocumentClassification = 'public' | 'internal' | 'confidential' | 'sensitive'
export type ExternalDocument = {
  externalRef: string
  versionRef: string
  title: string
  mimeType: string
  classification: DocumentClassification
  content: string
  modifiedAt: string
  sourceUrl?: string
}

export type DocumentChunk = {
  id: string
  documentId: string
  externalRef: string
  versionRef: string
  title: string
  chunkNo: number
  content: string
  classification: Exclude<DocumentClassification, 'sensitive'>
  sourceUrl?: string
  trust: 'untrusted_external'
}

export type IndexedDocument = {
  id: string
  ownerId: string
  provider: string
  externalRef: string
  versionRef: string
  contentHash: string
  title: string
  chunks: readonly DocumentChunk[]
}

export interface DocumentSourceAdapter {
  readonly id: string
  isAvailable(): boolean | Promise<boolean>
  readAuthorized(input: { ownerId: string; externalRef: string; signal?: AbortSignal }): Promise<ExternalDocument>
}

export interface KnowledgeRepository {
  find(ownerId: string, provider: string, externalRef: string): Promise<IndexedDocument | null>
  save(document: IndexedDocument): Promise<void>
  search(ownerId: string, query: string, limit: number): Promise<readonly DocumentChunk[]>
}

export type IngestionTrace = {
  correlationId: string
  provider: string
  status: 'indexed' | 'unchanged' | 'failed'
  externalRefHash: string
  chunks: number
  durationMs: number
  errorCode?: 'source_unavailable' | 'unsupported_type' | 'sensitive_document' | 'cancelled' | 'source_error'
}
export interface KnowledgeObserver { record(trace: IngestionTrace): void | Promise<void> }

export class KnowledgeStoreError extends Error {
  constructor(readonly code: NonNullable<IngestionTrace['errorCode']>) { super(code); this.name = 'KnowledgeStoreError' }
}

const supportedTypes = new Set(['text/plain', 'text/markdown', 'text/csv', 'application/pdf', 'application/vnd.google-apps.document'])
const words = (value: string) => value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]{3,}/g) ?? []

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function chunkDocument(documentId: string, document: ExternalDocument, maxCharacters = 1_500): DocumentChunk[] {
  if (!supportedTypes.has(document.mimeType)) throw new KnowledgeStoreError('unsupported_type')
  if (document.classification === 'sensitive' || containsSecret(document.content)) throw new KnowledgeStoreError('sensitive_document')
  const classification: DocumentChunk['classification'] = document.classification
  const paragraphs = document.content.replace(/\r/g, '').split(/\n{2,}/).map((item) => item.trim()).filter(Boolean)
  const chunks: string[] = []
  let current = ''
  for (const paragraph of paragraphs) {
    const parts = paragraph.length > maxCharacters ? paragraph.match(new RegExp(`[\\s\\S]{1,${maxCharacters}}`, 'g')) ?? [] : [paragraph]
    for (const part of parts) {
      if (current && current.length + part.length + 2 > maxCharacters) { chunks.push(current); current = '' }
      current = current ? `${current}\n\n${part}` : part
    }
  }
  if (current) chunks.push(current)
  return chunks.map((content, chunkNo) => ({ id: `${documentId}:${chunkNo}`, documentId, externalRef: document.externalRef, versionRef: document.versionRef, title: document.title, chunkNo, content, classification, sourceUrl: document.sourceUrl, trust: 'untrusted_external' }))
}

export class KnowledgeStore {
  constructor(private readonly sources: readonly DocumentSourceAdapter[], private readonly repository: KnowledgeRepository, private readonly observer?: KnowledgeObserver) {}

  async ingest(input: { ownerId: string; provider: string; externalRef: string; correlationId: string; signal?: AbortSignal }) {
    const started = Date.now()
    const source = this.sources.find((item) => item.id === input.provider)
    let trace: IngestionTrace
    try {
      if (!source || !await source.isAvailable()) throw new KnowledgeStoreError('source_unavailable')
      if (input.signal?.aborted) throw new KnowledgeStoreError('cancelled')
      const external = await source.readAuthorized(input)
      const contentHash = await sha256(external.content)
      const externalRefHash = (await sha256(input.externalRef)).slice(0, 16)
      const existing = await this.repository.find(input.ownerId, input.provider, input.externalRef)
      if (existing?.contentHash === contentHash && existing.versionRef === external.versionRef) {
        trace = { correlationId: input.correlationId, provider: input.provider, status: 'unchanged', externalRefHash, chunks: existing.chunks.length, durationMs: Date.now() - started }
        await this.observer?.record(trace)
        return { action: 'unchanged' as const, document: existing }
      }
      const id = existing?.id ?? crypto.randomUUID()
      const chunks = chunkDocument(id, external)
      const document: IndexedDocument = { id, ownerId: input.ownerId, provider: input.provider, externalRef: input.externalRef, versionRef: external.versionRef, contentHash, title: external.title, chunks }
      await this.repository.save(document)
      trace = { correlationId: input.correlationId, provider: input.provider, status: 'indexed', externalRefHash, chunks: chunks.length, durationMs: Date.now() - started }
      await this.observer?.record(trace)
      return { action: 'indexed' as const, document }
    } catch (error) {
      const code = error instanceof KnowledgeStoreError ? error.code : input.signal?.aborted ? 'cancelled' : 'source_error'
      trace = { correlationId: input.correlationId, provider: input.provider, status: 'failed', externalRefHash: (await sha256(input.externalRef)).slice(0, 16), chunks: 0, durationMs: Date.now() - started, errorCode: code }
      await this.observer?.record(trace)
      throw error instanceof KnowledgeStoreError ? error : new KnowledgeStoreError(code)
    }
  }

  async retrieve(ownerId: string, query: string, limit = 5) {
    if (!query.trim()) return []
    return this.repository.search(ownerId, query, Math.max(1, Math.min(limit, 10)))
  }
}

export class FakeDocumentSource implements DocumentSourceAdapter {
  readonly id = 'fake-drive'
  constructor(private readonly documents: ReadonlyMap<string, ExternalDocument>, private readonly available = true) {}
  isAvailable() { return this.available }
  async readAuthorized(input: { externalRef: string; signal?: AbortSignal }) {
    if (input.signal?.aborted) throw new KnowledgeStoreError('cancelled')
    const document = this.documents.get(input.externalRef)
    if (!document) throw new KnowledgeStoreError('source_error')
    return document
  }
}

export class InMemoryKnowledgeRepository implements KnowledgeRepository {
  private readonly documents = new Map<string, IndexedDocument>()
  async find(ownerId: string, provider: string, externalRef: string) { return this.documents.get(`${ownerId}:${provider}:${externalRef}`) ?? null }
  async save(document: IndexedDocument) { this.documents.set(`${document.ownerId}:${document.provider}:${document.externalRef}`, document) }
  async search(ownerId: string, query: string, limit: number) {
    const queryTerms = new Set(words(query))
    return [...this.documents.values()].filter((item) => item.ownerId === ownerId).flatMap((item) => item.chunks)
      .map((chunk) => ({ chunk, score: words(chunk.content).filter((term) => queryTerms.has(term)).length }))
      .filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id)).slice(0, limit).map((item) => item.chunk)
  }
}
