-- Pegasus - Migration 001: initial core schema
-- Source of truth: docs/01-architecture/DATA_MODEL.md + DATABASE.md
-- Scope: safe V1 foundation. Later migrations extend memory, documents, integrations,
-- tasks, devices, meeting/vision and operational policies without manual schema drift.

begin;

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Identity profile (auth.users remains managed by Supabase Auth)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'America/Sao_Paulo',
  locale text not null default 'pt-BR',
  status text not null default 'active' check (status in ('active','suspended','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Knowledge entities
-- -----------------------------------------------------------------------------
create table public.people (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  preferred_name text,
  aliases text[] not null default '{}',
  organization_name text,
  role_title text,
  relationship_context text,
  notes text,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('planned','active','paused','completed','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, name)
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, name)
);

-- -----------------------------------------------------------------------------
-- Conversations
-- -----------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text,
  channel text not null default 'web' check (channel in ('web','voice','meeting','device','system')),
  status text not null default 'active' check (status in ('active','closed','archived')),
  retention_mode text not null default 'curated' check (retention_mode in ('curated','keep','discard_after_processing')),
  summary text,
  project_id uuid references public.projects(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system','tool')),
  content text,
  content_classification text not null default 'internal' check (content_classification in ('public','internal','confidential','sensitive')),
  model_provider text,
  model_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Curated memory
-- -----------------------------------------------------------------------------
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  memory_type text not null,
  title text,
  content text not null,
  scope text not null default 'general',
  status text not null default 'active' check (status in ('active','superseded','corrected','archived','deleted')),
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  relevance numeric(5,4) check (relevance is null or (relevance >= 0 and relevance <= 1)),
  authority text,
  source_kind text,
  source_ref text,
  project_id uuid references public.projects(id) on delete set null,
  person_id uuid references public.people(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memory_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  memory_id uuid not null references public.memories(id) on delete cascade,
  version_no integer not null check (version_no > 0),
  content text not null,
  change_reason text,
  created_at timestamptz not null default now(),
  unique(memory_id, version_no)
);

-- -----------------------------------------------------------------------------
-- Persistent tasks
-- -----------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  objective text,
  status text not null default 'planning' check (status in (
    'planning','queued','running','waiting_external','waiting_approval','waiting_device',
    'paused','completed','partially_completed','failed','cancelled','expired'
  )),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  progress numeric(5,2) not null default 0 check (progress >= 0 and progress <= 100),
  result_summary text,
  error_summary text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.task_steps (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  step_no integer not null check (step_no > 0),
  title text not null,
  status text not null default 'queued' check (status in ('queued','running','waiting','completed','failed','skipped','cancelled')),
  result_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(task_id, step_no)
);

-- -----------------------------------------------------------------------------
-- Authorized devices / Device Gateway foundation
-- No private key or reusable secret is stored here.
-- -----------------------------------------------------------------------------
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  friendly_name text not null,
  device_type text not null default 'unknown',
  os_name text,
  os_version text,
  agent_version text,
  trust_level text not null default 'untrusted' check (trust_level in ('untrusted','temporary','trusted')),
  execution_level text not null default 'observe' check (execution_level in ('observe','assist','act','elevated')),
  public_key text,
  capabilities jsonb not null default '{}'::jsonb,
  status text not null default 'offline' check (status in ('offline','online','revoked')),
  paired_at timestamptz,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.device_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  event_type text not null,
  risk_level text not null default 'info' check (risk_level in ('info','attention','important','critical')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- AI usage / cost observability
-- -----------------------------------------------------------------------------
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  provider text not null,
  model text not null,
  tier text,
  input_units bigint not null default 0 check (input_units >= 0),
  output_units bigint not null default 0 check (output_units >= 0),
  audio_input_units bigint not null default 0 check (audio_input_units >= 0),
  audio_output_units bigint not null default 0 check (audio_output_units >= 0),
  estimated_cost_usd numeric(14,6) not null default 0 check (estimated_cost_usd >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  selection_reason text,
  fallback_used boolean not null default false,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Append-oriented audit
-- -----------------------------------------------------------------------------
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  actor_type text not null,
  actor_ref text,
  session_ref text,
  action text not null,
  target_type text,
  target_ref text,
  outcome text not null,
  risk_level text not null default 'info' check (risk_level in ('info','attention','important','critical')),
  correlation_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Indexes for initial access patterns
-- -----------------------------------------------------------------------------
create index people_owner_name_idx on public.people(owner_id, full_name);
create index conversations_owner_started_idx on public.conversations(owner_id, started_at desc);
create index messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index memories_owner_status_idx on public.memories(owner_id, status, updated_at desc);
create index tasks_owner_status_idx on public.tasks(owner_id, status, updated_at desc);
create index task_steps_task_step_idx on public.task_steps(task_id, step_no);
create index devices_owner_status_idx on public.devices(owner_id, status);
create index device_events_device_created_idx on public.device_events(device_id, created_at desc);
create index ai_usage_owner_created_idx on public.ai_usage(owner_id, created_at desc);
create index audit_owner_created_idx on public.audit_events(owner_id, created_at desc);
create index audit_correlation_idx on public.audit_events(correlation_id) where correlation_id is not null;

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger people_set_updated_at before update on public.people
for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects
for each row execute function public.set_updated_at();
create trigger topics_set_updated_at before update on public.topics
for each row execute function public.set_updated_at();
create trigger conversations_set_updated_at before update on public.conversations
for each row execute function public.set_updated_at();
create trigger memories_set_updated_at before update on public.memories
for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();
create trigger task_steps_set_updated_at before update on public.task_steps
for each row execute function public.set_updated_at();
create trigger devices_set_updated_at before update on public.devices
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS: deny-by-default unless explicit owner policy below exists.
-- audit_events intentionally has no direct authenticated policies in Migration 001.
-- Trusted backend/service role records audit events.
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.people enable row level security;
alter table public.projects enable row level security;
alter table public.topics enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.memories enable row level security;
alter table public.memory_versions enable row level security;
alter table public.tasks enable row level security;
alter table public.task_steps enable row level security;
alter table public.devices enable row level security;
alter table public.device_events enable row level security;
alter table public.ai_usage enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_owner_all on public.profiles
for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy people_owner_all on public.people
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy projects_owner_all on public.projects
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy topics_owner_all on public.topics
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy conversations_owner_all on public.conversations
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy messages_owner_all on public.messages
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy memories_owner_all on public.memories
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy memory_versions_owner_all on public.memory_versions
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy tasks_owner_all on public.tasks
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy task_steps_owner_all on public.task_steps
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy devices_owner_all on public.devices
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy device_events_owner_select on public.device_events
for select to authenticated using (owner_id = auth.uid());
create policy ai_usage_owner_select on public.ai_usage
for select to authenticated using (owner_id = auth.uid());

-- Explicit API grants. RLS remains authoritative for authenticated access.
-- anon receives no domain-table grants in this migration.
revoke all on table public.profiles, public.people, public.projects, public.topics,
  public.conversations, public.messages, public.memories, public.memory_versions,
  public.tasks, public.task_steps, public.devices, public.device_events,
  public.ai_usage, public.audit_events from anon;

grant select, insert, update, delete on table public.profiles, public.people,
  public.projects, public.topics, public.conversations, public.messages,
  public.memories, public.memory_versions, public.tasks, public.task_steps,
  public.devices to authenticated;

grant select on table public.device_events, public.ai_usage to authenticated;
revoke all on table public.audit_events from authenticated;

commit;
