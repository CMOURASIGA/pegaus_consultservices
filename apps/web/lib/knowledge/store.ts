import 'server-only'

import type { DocumentChunk, IndexedDocument, KnowledgeRepository } from '@pegasus/core'
import { AppError } from '@pegasus/shared'
import type { SupabaseClient } from '@supabase/supabase-js'

type DocumentRow = { id: string; owner_id: string; provider: string; external_ref: string; title: string; content_hash: string | null; metadata: Record<string, unknown> | null }
type VersionRow = { id: string; document_id: string; version_ref: string | null; content_hash: string | null; metadata: Record<string, unknown> | null }
type ChunkRow = { id: string; document_version_id: string; chunk_no: number; content: string; metadata: Record<string, unknown> | null }

export class SupabaseKnowledgeRepository implements KnowledgeRepository {
  constructor(private readonly client: SupabaseClient) {}

  async find(ownerId: string, provider: string, externalRef: string): Promise<IndexedDocument | null> {
    const { data: document, error } = await this.client.from('documents').select('id,owner_id,provider,external_ref,title,content_hash,metadata').eq('owner_id', ownerId).eq('provider', provider).eq('external_ref', externalRef).maybeSingle()
    if (error) throw new AppError('KNOWLEDGE_READ_FAILED', 'Não foi possível consultar o documento.', 503)
    if (!document) return null
    const { data: version, error: versionError } = await this.client.from('document_versions').select('id,document_id,version_ref,content_hash,metadata').eq('owner_id', ownerId).eq('document_id', document.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (versionError) throw new AppError('KNOWLEDGE_READ_FAILED', 'Não foi possível consultar a versão do documento.', 503)
    const chunks = version ? await this.readChunks(ownerId, document as DocumentRow, version as VersionRow) : []
    const metadata = (document.metadata ?? {}) as Record<string, unknown>
    return { id: document.id, ownerId, provider, externalRef, versionRef: version?.version_ref ?? '', contentHash: version?.content_hash ?? document.content_hash ?? '', title: document.title, chunks: chunks.map((chunk) => ({ ...chunk, sourceUrl: typeof metadata.source_url === 'string' ? metadata.source_url : undefined })) }
  }

  async list(ownerId: string, limit = 100) {
    const { data, error } = await this.client.from('documents').select('id,title,provider,external_ref,mime_type,classification,indexing_status,updated_at,metadata').eq('owner_id', ownerId).neq('indexing_status', 'excluded').order('updated_at', { ascending: false }).limit(limit)
    if (error) throw new AppError('KNOWLEDGE_READ_FAILED', 'Não foi possível consultar os documentos.', 503)
    return data as Array<{ id: string; title: string; provider: string; external_ref: string; mime_type: string | null; classification: string; indexing_status: string; updated_at: string; metadata: Record<string, unknown> | null }>
  }

  async driveStatus(ownerId: string) {
    const { data, error } = await this.client.from('integrations').select('status,last_health_at').eq('owner_id', ownerId).eq('provider', 'google_drive').order('updated_at', { ascending: false }).limit(1).maybeSingle()
    if (error) throw new AppError('INTEGRATION_READ_FAILED', 'Não foi possível consultar a conexão do Google Drive.', 503)
    return data as { status: string; last_health_at: string | null } | null
  }

  private async readChunks(ownerId: string, document: DocumentRow, version: VersionRow): Promise<DocumentChunk[]> {
    const { data, error } = await this.client.from('document_chunks').select('id,document_version_id,chunk_no,content,metadata').eq('owner_id', ownerId).eq('document_version_id', version.id).order('chunk_no')
    if (error) throw new AppError('KNOWLEDGE_READ_FAILED', 'Não foi possível consultar os trechos do documento.', 503)
    return (data as ChunkRow[]).map((row) => ({ id: row.id, documentId: document.id, externalRef: document.external_ref, versionRef: version.version_ref ?? '', title: document.title, chunkNo: row.chunk_no, content: row.content, classification: ((row.metadata?.classification as DocumentChunk['classification']) ?? 'internal'), trust: 'untrusted_external' }))
  }

  async save(document: IndexedDocument) {
    const first = document.chunks[0]
    const metadata = { source_url: first?.sourceUrl, external_content_trust: 'untrusted' }
    const { data: row, error } = await this.client.from('documents').upsert({ id: document.id, owner_id: document.ownerId, provider: document.provider, external_ref: document.externalRef, title: document.title, mime_type: 'text/plain', classification: first?.classification ?? 'internal', content_hash: document.contentHash, indexing_status: 'indexing', ingestion_source: document.provider, metadata }, { onConflict: 'owner_id,provider,external_ref' }).select('id').single()
    if (error || !row) throw new AppError('KNOWLEDGE_SAVE_FAILED', 'Não foi possível registrar o documento.', 503)
    const { data: version, error: versionError } = await this.client.from('document_versions').insert({ owner_id: document.ownerId, document_id: row.id, version_ref: document.versionRef, content_hash: document.contentHash, metadata: { external_content_trust: 'untrusted' } }).select('id').single()
    if (versionError || !version) { await this.fail(document.ownerId, row.id); throw new AppError('KNOWLEDGE_SAVE_FAILED', 'Não foi possível registrar a versão do documento.', 503) }
    const payload = document.chunks.map((chunk) => ({ owner_id: document.ownerId, document_version_id: version.id, chunk_no: chunk.chunkNo, content: chunk.content, token_count: Math.ceil(chunk.content.length / 4), metadata: { classification: chunk.classification, external_ref_hash_only_in_logs: true, external_content_trust: chunk.trust } }))
    const { error: chunkError } = payload.length ? await this.client.from('document_chunks').insert(payload) : { error: null }
    if (chunkError) { await this.fail(document.ownerId, row.id); throw new AppError('KNOWLEDGE_SAVE_FAILED', 'Não foi possível indexar o conteúdo.', 503) }
    const { error: readyError } = await this.client.from('documents').update({ indexing_status: 'ready' }).eq('owner_id', document.ownerId).eq('id', row.id)
    if (readyError) throw new AppError('KNOWLEDGE_SAVE_FAILED', 'Não foi possível concluir a indexação.', 503)
    await this.client.from('document_versions').update({ indexed_at: new Date().toISOString() }).eq('owner_id', document.ownerId).eq('id', version.id)
  }

  private async fail(ownerId: string, documentId: string) { await this.client.from('documents').update({ indexing_status: 'failed' }).eq('owner_id', ownerId).eq('id', documentId) }

  async search(ownerId: string, query: string, limit: number): Promise<readonly DocumentChunk[]> {
    const terms = query.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]{3,}/g)?.slice(0, 8) ?? []
    if (!terms.length) return []
    const { data, error } = await this.client.from('document_chunks').select('id,document_version_id,chunk_no,content,metadata,document_versions!inner(id,version_ref,document_id,documents!inner(id,title,provider,external_ref,indexing_status,metadata))').eq('owner_id', ownerId).eq('document_versions.documents.indexing_status', 'ready').or(terms.map((term) => `content.ilike.%${term.replace(/[%_,()]/g, '')}%`).join(',')).limit(Math.max(limit * 3, 10))
    if (error) throw new AppError('KNOWLEDGE_SEARCH_FAILED', 'Não foi possível pesquisar os documentos.', 503)
    const normalized = (value: string) => value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return (data as unknown as Array<ChunkRow & { document_versions: { version_ref: string; document_id: string; documents: { id: string; title: string; external_ref: string; metadata: Record<string, unknown> | null } } }>).map((row) => {
      const parent = row.document_versions.documents
      const score = terms.filter((term) => normalized(row.content).includes(term)).length
      return { score, chunk: { id: row.id, documentId: parent.id, externalRef: parent.external_ref, versionRef: row.document_versions.version_ref, title: parent.title, chunkNo: row.chunk_no, content: row.content, classification: ((row.metadata?.classification as DocumentChunk['classification']) ?? 'internal'), sourceUrl: typeof parent.metadata?.source_url === 'string' ? parent.metadata.source_url : undefined, trust: 'untrusted_external' as const } }
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id)).slice(0, limit).map((item) => item.chunk)
  }
}
