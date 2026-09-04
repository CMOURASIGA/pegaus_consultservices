import 'server-only'

import { AppError } from '@pegasus/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatAttachment } from './types'
import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES } from './attachment-limits'

const allowedTypes = new Set<string>(ALLOWED_ATTACHMENT_TYPES)

function safeFilename(name: string) {
  const normalized = name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^[.-]+/, '').slice(-120)
  return normalized && normalized !== '.' ? normalized : 'arquivo'
}

function hasExpectedSignature(type: string, bytes: Uint8Array) {
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (type === 'image/png') return bytes.slice(0, 8).every((value, index) => value === [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a][index])
  if (type === 'image/webp') return new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  if (type === 'application/pdf') return new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-'
  return type === 'text/plain' || type === 'text/markdown'
}

export async function uploadChatAttachments(client: SupabaseClient, ownerId: string, files: File[]): Promise<ChatAttachment[]> {
  if (files.length > MAX_ATTACHMENTS) throw new AppError('TOO_MANY_ATTACHMENTS', `Envie no máximo ${MAX_ATTACHMENTS} arquivos por mensagem.`, 400)
  const uploaded: Array<{ path: string; attachment: ChatAttachment }> = []
  try {
    for (const file of files) {
      if (!allowedTypes.has(file.type)) throw new AppError('ATTACHMENT_TYPE_NOT_ALLOWED', 'Este formato de arquivo não é permitido.', 415)
      if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) throw new AppError('ATTACHMENT_SIZE_INVALID', 'Cada arquivo deve ter até 10 MB.', 413)
      const data = new Uint8Array(await file.arrayBuffer())
      if (!hasExpectedSignature(file.type, data)) throw new AppError('ATTACHMENT_CONTENT_INVALID', 'O conteúdo do arquivo não corresponde ao formato informado.', 400)
      const path = `${ownerId}/chat/${crypto.randomUUID()}-${safeFilename(file.name)}`
      const storage = await client.storage.from('pegasus-private').upload(path, data, { contentType: file.type, upsert: false })
      if (storage.error) throw new AppError('ATTACHMENT_UPLOAD_FAILED', 'Não foi possível armazenar o anexo.', 503)
      const { data: document, error } = await client.from('documents').insert({ owner_id: ownerId, title: file.name, provider: 'supabase_storage', external_ref: path, storage_bucket: 'pegasus-private', storage_path: path, file_size_bytes: file.size, original_filename: file.name, mime_type: file.type, classification: 'internal', indexing_status: 'excluded', ingestion_source: 'upload', metadata: { source: 'chat', external_content_trust: 'untrusted' } }).select('id').single()
      if (error) { await client.storage.from('pegasus-private').remove([path]); throw new AppError('ATTACHMENT_METADATA_FAILED', 'Não foi possível registrar o anexo.', 503) }
      uploaded.push({ path, attachment: { id: document.id as string, name: file.name, mediaType: file.type, size: file.size, classification: 'internal' } })
    }
    return uploaded.map((item) => item.attachment)
  } catch (error) {
    if (uploaded.length) await client.storage.from('pegasus-private').remove(uploaded.map((item) => item.path))
    throw error
  }
}
