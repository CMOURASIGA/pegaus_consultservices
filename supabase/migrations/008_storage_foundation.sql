-- Pegasus - Migration 008: private operational Storage foundation
-- Google Drive remains the primary Knowledge Store. This bucket is for Pegasus
-- operational uploads/attachments/artifacts that require controlled app access.
-- Object path contract: <auth.uid()>/<category>/<uuid-or-safe-filename>

begin;

-- -----------------------------------------------------------------------------
-- Private bucket. 25 MiB/object is intentionally conservative for V1.
-- Expand only after observing real usage/cost and ingestion requirements.
-- -----------------------------------------------------------------------------
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'pegasus-private',
  'pegasus-private',
  false,
  26214400,
  array[
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/webp',
    'audio/mpeg',
    'audio/mp4',
    'audio/webm',
    'video/mp4',
    'video/webm'
  ]::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Storage RLS policies.
-- Ownership is enforced by the first path segment, not user-supplied metadata.
-- Example: 3e826.../uploads/contract.pdf
-- -----------------------------------------------------------------------------
drop policy if exists pegasus_private_owner_select on storage.objects;
create policy pegasus_private_owner_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'pegasus-private'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists pegasus_private_owner_insert on storage.objects;
create policy pegasus_private_owner_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'pegasus-private'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists pegasus_private_owner_update on storage.objects;
create policy pegasus_private_owner_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'pegasus-private'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'pegasus-private'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists pegasus_private_owner_delete on storage.objects;
create policy pegasus_private_owner_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'pegasus-private'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- -----------------------------------------------------------------------------
-- Extend document metadata so one catalog can reference either Google Drive or
-- Pegasus private Storage without duplicating file contents unnecessarily.
-- Existing external_ref remains the provider-specific object/file reference.
-- -----------------------------------------------------------------------------
alter table public.documents
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists file_size_bytes bigint
    check (file_size_bytes is null or file_size_bytes >= 0),
  add column if not exists original_filename text,
  add column if not exists ingestion_source text not null default 'integration'
    check (ingestion_source in ('integration','upload','device_agent','meeting','generated','import'));

-- Provider-specific integrity: Supabase Storage documents must identify bucket/path.
-- Google Drive and other integrations continue using external_ref.
alter table public.documents
  drop constraint if exists documents_storage_location_check;

alter table public.documents
  add constraint documents_storage_location_check check (
    provider <> 'supabase_storage'
    or (
      storage_bucket = 'pegasus-private'
      and storage_path is not null
      and length(trim(storage_path)) > 0
    )
  );

create index if not exists idx_documents_storage_location
  on public.documents(owner_id, storage_bucket, storage_path)
  where storage_path is not null;

commit;
