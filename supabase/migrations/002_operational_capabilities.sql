-- Pegasus - Migration 002: operational capabilities
-- Documents, integrations, permissions, approvals, tools/skills and memory relations.

begin;

-- Organizations / clients and generic entity graph
create table public.organizations (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null, organization_type text, metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(owner_id,name)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null, name text not null,
  metadata jsonb not null default '{}'::jsonb, status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.entity_relations (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null, source_id uuid not null, relation_type text not null, target_type text not null, target_id uuid not null,
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1), metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Memory provenance / relations
create table public.memory_sources (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  memory_id uuid not null references public.memories(id) on delete cascade, source_type text not null, source_ref text,
  authority text, confidence numeric(5,4) check (confidence is null or confidence between 0 and 1), created_at timestamptz not null default now()
);

create table public.memory_relations (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  source_memory_id uuid not null references public.memories(id) on delete cascade,
  target_memory_id uuid not null references public.memories(id) on delete cascade,
  relation_type text not null, created_at timestamptz not null default now(),
  check (source_memory_id <> target_memory_id)
);

-- Drive-backed Knowledge Store metadata
create table public.documents (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null, provider text not null default 'google_drive', external_ref text not null,
  mime_type text, classification text not null default 'internal' check (classification in ('public','internal','confidential','sensitive')),
  content_hash text, indexing_status text not null default 'pending' check (indexing_status in ('pending','indexing','ready','failed','excluded')),
  project_id uuid references public.projects(id) on delete set null, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(owner_id,provider,external_ref)
);

create table public.document_versions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade, version_ref text, content_hash text,
  indexed_at timestamptz, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  document_version_id uuid not null references public.document_versions(id) on delete cascade,
  chunk_no integer not null check (chunk_no >= 0), content text not null, token_count integer check (token_count is null or token_count >= 0),
  embedding_model text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  unique(document_version_id,chunk_no)
);

-- Integrations: secret_ref is only an opaque reference to external Secret Manager, never the secret itself.
create table public.integrations (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null, display_name text not null, status text not null default 'disconnected' check (status in ('disconnected','connecting','active','degraded','revoked','error')),
  secret_ref text, metadata jsonb not null default '{}'::jsonb, last_used_at timestamptz, last_health_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(owner_id,provider,display_name)
);

create table public.integration_capabilities (
  id uuid primary key default gen_random_uuid(), integration_id uuid not null references public.integrations(id) on delete cascade,
  capability_key text not null, description text, risk_level text not null default 'low' check (risk_level in ('low','medium','high','critical')),
  created_at timestamptz not null default now(), unique(integration_id,capability_key)
);

create table public.granted_permissions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  integration_id uuid not null references public.integrations(id) on delete cascade,
  capability_id uuid references public.integration_capabilities(id) on delete cascade,
  scope jsonb not null default '{}'::jsonb, status text not null default 'active' check (status in ('active','expired','revoked')),
  granted_at timestamptz not null default now(), expires_at timestamptz, revoked_at timestamptz,
  check (expires_at is null or expires_at > granted_at)
);

create table public.integration_events (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  integration_id uuid not null references public.integrations(id) on delete cascade, event_type text not null,
  outcome text not null, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

-- Tools / Skills registry. Execution remains server-side through Guard/policy pipeline.
create table public.tools (
  id uuid primary key default gen_random_uuid(), tool_key text not null unique, name text not null, description text,
  risk_level text not null default 'low' check (risk_level in ('low','medium','high','critical')),
  status text not null default 'active' check (status in ('active','disabled','deprecated')), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.tool_capabilities (
  id uuid primary key default gen_random_uuid(), tool_id uuid not null references public.tools(id) on delete cascade,
  capability_key text not null, operation text not null, approval_level text not null default 'none' check (approval_level in ('none','approval','strong_approval')),
  metadata jsonb not null default '{}'::jsonb, unique(tool_id,capability_key,operation)
);

create table public.skills (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  skill_key text not null, name text not null, description text, origin text not null default 'system',
  status text not null default 'draft' check (status in ('draft','active','disabled','archived')),
  risk_level text not null default 'low' check (risk_level in ('low','medium','high','critical')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(owner_id,skill_key)
);

create table public.skill_versions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade, version_no integer not null check (version_no > 0),
  specification jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), unique(skill_id,version_no)
);

create table public.skill_tools (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade, tool_id uuid not null references public.tools(id) on delete restrict,
  capability_scope jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), unique(skill_id,tool_id)
);

-- Decision Guard / human approval
create table public.decision_inbox_items (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null, title text not null, description text,
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high','critical')),
  recommended_action text, status text not null default 'pending' check (status in ('pending','approved','rejected','expired','resolved')),
  created_at timestamptz not null default now(), resolved_at timestamptz
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  decision_item_id uuid references public.decision_inbox_items(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null, action_type text not null, action_payload jsonb not null default '{}'::jsonb,
  approval_level text not null default 'approval' check (approval_level in ('approval','strong_approval')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','revoked','consumed')),
  expires_at timestamptz, approved_at timestamptz, consumed_at timestamptz, created_at timestamptz not null default now()
);

create table public.approval_events (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  approval_id uuid not null references public.approvals(id) on delete cascade, event_type text not null,
  actor_type text not null, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

-- indexes
create index entity_relations_owner_source_idx on public.entity_relations(owner_id,source_type,source_id);
create index memory_sources_memory_idx on public.memory_sources(memory_id);
create index memory_relations_source_idx on public.memory_relations(source_memory_id);
create index documents_owner_status_idx on public.documents(owner_id,indexing_status,updated_at desc);
create index document_versions_document_idx on public.document_versions(document_id,created_at desc);
create index document_chunks_version_idx on public.document_chunks(document_version_id,chunk_no);
create index integrations_owner_status_idx on public.integrations(owner_id,status);
create index permissions_owner_status_idx on public.granted_permissions(owner_id,status);
create index integration_events_integration_idx on public.integration_events(integration_id,created_at desc);
create index decision_inbox_owner_status_idx on public.decision_inbox_items(owner_id,status,created_at desc);
create index approvals_owner_status_idx on public.approvals(owner_id,status,created_at desc);

-- updated_at triggers
create trigger organizations_set_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger clients_set_updated_at before update on public.clients for each row execute function public.set_updated_at();
create trigger documents_set_updated_at before update on public.documents for each row execute function public.set_updated_at();
create trigger integrations_set_updated_at before update on public.integrations for each row execute function public.set_updated_at();
create trigger tools_set_updated_at before update on public.tools for each row execute function public.set_updated_at();
create trigger skills_set_updated_at before update on public.skills for each row execute function public.set_updated_at();

-- RLS
alter table public.organizations enable row level security; alter table public.clients enable row level security;
alter table public.entity_relations enable row level security; alter table public.memory_sources enable row level security;
alter table public.memory_relations enable row level security; alter table public.documents enable row level security;
alter table public.document_versions enable row level security; alter table public.document_chunks enable row level security;
alter table public.integrations enable row level security; alter table public.integration_capabilities enable row level security;
alter table public.granted_permissions enable row level security; alter table public.integration_events enable row level security;
alter table public.tools enable row level security; alter table public.tool_capabilities enable row level security;
alter table public.skills enable row level security; alter table public.skill_versions enable row level security;
alter table public.skill_tools enable row level security; alter table public.decision_inbox_items enable row level security;
alter table public.approvals enable row level security; alter table public.approval_events enable row level security;

-- Owner-facing domain policies
create policy organizations_owner_all on public.organizations for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy clients_owner_all on public.clients for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy entity_relations_owner_all on public.entity_relations for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy memory_sources_owner_all on public.memory_sources for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy memory_relations_owner_all on public.memory_relations for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy documents_owner_all on public.documents for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy document_versions_owner_all on public.document_versions for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy document_chunks_owner_select on public.document_chunks for select to authenticated using(owner_id=auth.uid());
create policy integrations_owner_all on public.integrations for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy granted_permissions_owner_select on public.granted_permissions for select to authenticated using(owner_id=auth.uid());
create policy integration_events_owner_select on public.integration_events for select to authenticated using(owner_id=auth.uid());
create policy skills_owner_all on public.skills for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy skill_versions_owner_select on public.skill_versions for select to authenticated using(owner_id=auth.uid());
create policy skill_tools_owner_select on public.skill_tools for select to authenticated using(owner_id=auth.uid());
create policy decision_inbox_owner_select on public.decision_inbox_items for select to authenticated using(owner_id=auth.uid());
create policy approvals_owner_select on public.approvals for select to authenticated using(owner_id=auth.uid());
create policy approval_events_owner_select on public.approval_events for select to authenticated using(owner_id=auth.uid());

-- System tool catalog can be read by authenticated users but not mutated directly.
create policy tools_authenticated_select on public.tools for select to authenticated using(true);
create policy tool_capabilities_authenticated_select on public.tool_capabilities for select to authenticated using(true);
-- integration capabilities visible only if parent integration belongs to current user.
create policy integration_capabilities_owner_select on public.integration_capabilities for select to authenticated
using (exists(select 1 from public.integrations i where i.id=integration_id and i.owner_id=auth.uid()));

-- Grants: anon none. Authenticated gets only what policies intentionally support.
revoke all on table public.organizations,public.clients,public.entity_relations,public.memory_sources,public.memory_relations,
 public.documents,public.document_versions,public.document_chunks,public.integrations,public.integration_capabilities,
 public.granted_permissions,public.integration_events,public.tools,public.tool_capabilities,public.skills,public.skill_versions,
 public.skill_tools,public.decision_inbox_items,public.approvals,public.approval_events from anon;

grant select,insert,update,delete on table public.organizations,public.clients,public.entity_relations,public.memory_sources,
 public.memory_relations,public.documents,public.document_versions,public.integrations,public.skills to authenticated;
grant select on table public.document_chunks,public.integration_capabilities,public.granted_permissions,public.integration_events,
 public.tools,public.tool_capabilities,public.skill_versions,public.skill_tools,public.decision_inbox_items,public.approvals,
 public.approval_events to authenticated;

commit;
