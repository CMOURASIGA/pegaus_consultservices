-- Pegasus - Migration 009: vector retrieval foundation
-- Adds semantic-vector storage to memories and document chunks.
-- Vector generation remains backend-only and model-agnostic.
-- Initial dimension: 1536. Changing embedding dimensions requires a controlled
-- migration/reindex; do not silently switch embedding models in production.

begin;

create extension if not exists vector with schema extensions;

-- -----------------------------------------------------------------------------
-- Semantic memory
-- -----------------------------------------------------------------------------
alter table public.memories
  add column if not exists embedding extensions.vector(1536),
  add column if not exists embedding_model text,
  add column if not exists embedded_at timestamptz;

-- -----------------------------------------------------------------------------
-- Document chunks
-- embedding_model already exists from Migration 002.
-- -----------------------------------------------------------------------------
alter table public.document_chunks
  add column if not exists embedding extensions.vector(1536),
  add column if not exists embedded_at timestamptz;

-- Exact model provenance is required whenever an embedding exists.
alter table public.memories
  drop constraint if exists memories_embedding_provenance_check;
alter table public.memories
  add constraint memories_embedding_provenance_check check (
    embedding is null
    or (embedding_model is not null and length(trim(embedding_model)) > 0 and embedded_at is not null)
  );

alter table public.document_chunks
  drop constraint if exists document_chunks_embedding_provenance_check;
alter table public.document_chunks
  add constraint document_chunks_embedding_provenance_check check (
    embedding is null
    or (embedding_model is not null and length(trim(embedding_model)) > 0 and embedded_at is not null)
  );

-- HNSW cosine indexes. Partial indexes avoid indexing rows not embedded yet.
create index if not exists idx_memories_embedding_hnsw
  on public.memories
  using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

create index if not exists idx_document_chunks_embedding_hnsw
  on public.document_chunks
  using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

-- -----------------------------------------------------------------------------
-- Retrieval functions live outside the API-exposed public schema.
-- They are backend-only: no PUBLIC/anon/authenticated EXECUTE.
-- p_owner_id is mandatory defense-in-depth; the trusted backend must pass the
-- authenticated owner explicitly after authorization.
--
-- pgvector is installed in schema `extensions`. The functions therefore include
-- `extensions` in their fixed search_path so PostgreSQL can resolve pgvector's
-- distance operators (<=>). This is safe here because `extensions` is a managed
-- extension schema, while application objects remain fully schema-qualified.
-- -----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.match_memories(
  p_owner_id uuid,
  p_query_embedding extensions.vector(1536),
  p_match_count integer default 10,
  p_min_similarity double precision default 0.0
)
returns table (
  id uuid,
  content text,
  similarity double precision,
  confidence numeric,
  relevance numeric,
  scope text,
  project_id uuid,
  person_id uuid,
  topic_id uuid
)
language sql
stable
security invoker
set search_path = 'extensions'
as $$
  select
    m.id,
    m.content,
    (1 - (m.embedding <=> p_query_embedding))::double precision as similarity,
    m.confidence,
    m.relevance,
    m.scope,
    m.project_id,
    m.person_id,
    m.topic_id
  from public.memories m
  where m.owner_id = p_owner_id
    and m.embedding is not null
    and m.status = 'active'
    and (1 - (m.embedding <=> p_query_embedding)) >= p_min_similarity
  order by m.embedding <=> p_query_embedding
  limit greatest(1, least(coalesce(p_match_count, 10), 50));
$$;

create or replace function private.match_document_chunks(
  p_owner_id uuid,
  p_query_embedding extensions.vector(1536),
  p_match_count integer default 10,
  p_min_similarity double precision default 0.0
)
returns table (
  chunk_id uuid,
  document_version_id uuid,
  document_id uuid,
  chunk_no integer,
  content text,
  similarity double precision,
  document_title text,
  classification text,
  provider text,
  external_ref text
)
language sql
stable
security invoker
set search_path = 'extensions'
as $$
  select
    c.id as chunk_id,
    c.document_version_id,
    v.document_id,
    c.chunk_no,
    c.content,
    (1 - (c.embedding <=> p_query_embedding))::double precision as similarity,
    d.title as document_title,
    d.classification,
    d.provider,
    d.external_ref
  from public.document_chunks c
  join public.document_versions v
    on v.id = c.document_version_id and v.owner_id = p_owner_id
  join public.documents d
    on d.id = v.document_id and d.owner_id = p_owner_id
  where c.owner_id = p_owner_id
    and c.embedding is not null
    and d.indexing_status = 'ready'
    and d.classification <> 'sensitive'
    and (1 - (c.embedding <=> p_query_embedding)) >= p_min_similarity
  order by c.embedding <=> p_query_embedding
  limit greatest(1, least(coalesce(p_match_count, 10), 50));
$$;

revoke all on function private.match_memories(uuid, extensions.vector, integer, double precision)
  from public, anon, authenticated;
revoke all on function private.match_document_chunks(uuid, extensions.vector, integer, double precision)
  from public, anon, authenticated;

-- Trusted server-side execution only.
grant usage on schema private to service_role;
grant execute on function private.match_memories(uuid, extensions.vector, integer, double precision)
  to service_role;
grant execute on function private.match_document_chunks(uuid, extensions.vector, integer, double precision)
  to service_role;

commit;
