-- Pegasus Migration 011: Device Agent local loop
-- Built from the observed production schema. Migrations 001-009 were historically
-- applied manually; this migration does not replay or repair that history.
-- DO NOT apply before code, RLS and runtime validation.
begin;

-- Operational aggregates become backend-mutated and owner-readable.
drop policy if exists devices_owner_all on public.devices;
drop policy if exists tasks_owner_all on public.tasks;
drop policy if exists task_steps_owner_all on public.task_steps;
create policy devices_owner_select on public.devices for select to authenticated using ((select auth.uid()) = owner_id);
create policy tasks_owner_select on public.tasks for select to authenticated using ((select auth.uid()) = owner_id);
create policy task_steps_owner_select on public.task_steps for select to authenticated using ((select auth.uid()) = owner_id);
revoke insert, update, delete on public.devices, public.tasks, public.task_steps from authenticated;
grant select on public.devices, public.tasks, public.task_steps to authenticated;
grant select, insert, update, delete on public.devices, public.tasks, public.task_steps to service_role;

alter table public.tasks
  add column if not exists idempotency_key text,
  add column if not exists state_version bigint not null default 0,
  add column if not exists correlation_id uuid;
create unique index if not exists tasks_owner_idempotency_uidx
  on public.tasks(owner_id, idempotency_key) where idempotency_key is not null;

alter table public.approvals
  add column if not exists device_id uuid references public.devices(id) on delete set null,
  add column if not exists capability text,
  add column if not exists target text,
  add column if not exists action_fingerprint text;
create index if not exists approvals_fingerprint_idx on public.approvals(owner_id, action_fingerprint);

create table public.device_capability_grants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  capability text not null,
  scope jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','expired','revoked')),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(device_id, capability)
);

create table public.device_agent_identities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  key_id text not null,
  public_key text not null,
  algorithm text not null default 'ECDSA_P256_SHA256',
  status text not null default 'active' check (status in ('active','rotated','revoked')),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  rotated_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(device_id, key_id)
);

create table public.device_request_nonces (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  identity_id uuid not null references public.device_agent_identities(id) on delete cascade,
  nonce_hash text not null,
  request_kind text not null,
  observed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique(identity_id, nonce_hash)
);

create table public.device_commands (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  task_step_id uuid references public.task_steps(id) on delete set null,
  device_id uuid not null references public.devices(id) on delete cascade,
  approval_id uuid references public.approvals(id) on delete set null,
  action_id uuid not null default gen_random_uuid(),
  idempotency_key text not null,
  capability text not null,
  operation text not null,
  target text not null,
  parameters jsonb not null default '{}'::jsonb,
  action_fingerprint text not null,
  command_nonce_hash text not null,
  protocol_version integer not null default 1 check (protocol_version = 1),
  status text not null default 'queued' check (status in ('queued','leased','acknowledged','running','completed','failed','cancelled','expired')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  available_at timestamptz not null default now(),
  expires_at timestamptz not null,
  lease_token_hash text,
  lease_expires_at timestamptz,
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, idempotency_key),
  unique(device_id, action_id)
);

create table public.device_execution_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  command_id uuid not null references public.device_commands(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  attempt_no integer not null check (attempt_no > 0),
  lease_token_hash text not null,
  status text not null default 'leased' check (status in ('leased','accepted','running','completed','failed','timed_out','rejected')),
  receipt_nonce_hash text,
  result_nonce_hash text,
  receipt_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  unique(command_id, attempt_no),
  unique(receipt_nonce_hash),
  unique(result_nonce_hash)
);

create table public.device_command_results (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  command_id uuid not null unique references public.device_commands(id) on delete cascade,
  attempt_id uuid not null unique references public.device_execution_attempts(id) on delete cascade,
  status text not null check (status in ('completed','failed')),
  output jsonb not null default '{}'::jsonb,
  error_code text,
  evidence_digest text,
  agent_version text not null,
  correlation_id uuid not null,
  received_at timestamptz not null default now()
);

create index device_capability_grants_lookup_idx on public.device_capability_grants(device_id, capability, status);
create index device_agent_identities_lookup_idx on public.device_agent_identities(device_id, status);
create index device_request_nonces_expiry_idx on public.device_request_nonces(expires_at);
create index device_commands_poll_idx on public.device_commands(device_id, status, available_at, expires_at);
create index device_commands_task_idx on public.device_commands(task_id, created_at);
create index device_execution_attempts_command_idx on public.device_execution_attempts(command_id, attempt_no desc);

alter table public.device_capability_grants enable row level security;
alter table public.device_agent_identities enable row level security;
alter table public.device_request_nonces enable row level security;
alter table public.device_commands enable row level security;
alter table public.device_execution_attempts enable row level security;
alter table public.device_command_results enable row level security;

create policy device_capability_grants_owner_select on public.device_capability_grants for select to authenticated using ((select auth.uid()) = owner_id);
create policy device_commands_owner_select on public.device_commands for select to authenticated using ((select auth.uid()) = owner_id);
create policy device_execution_attempts_owner_select on public.device_execution_attempts for select to authenticated using ((select auth.uid()) = owner_id);
create policy device_command_results_owner_select on public.device_command_results for select to authenticated using ((select auth.uid()) = owner_id);

revoke all on public.device_capability_grants, public.device_agent_identities,
  public.device_request_nonces, public.device_commands,
  public.device_execution_attempts, public.device_command_results
from public, anon, authenticated;
grant select on public.device_capability_grants, public.device_commands,
  public.device_execution_attempts, public.device_command_results to authenticated;
grant select, insert, update, delete on public.device_capability_grants,
  public.device_agent_identities, public.device_request_nonces, public.device_commands,
  public.device_execution_attempts, public.device_command_results to service_role;

drop trigger if exists device_commands_set_updated_at on public.device_commands;
create trigger device_commands_set_updated_at before update on public.device_commands
for each row execute function public.set_updated_at();

-- Atomic state transition. Caller must supply expected version and allowed predecessor.
create or replace function public.transition_task(
  p_task_id uuid, p_owner_id uuid, p_from_status text, p_to_status text,
  p_expected_version bigint, p_progress numeric default null,
  p_result_summary text default null, p_error_summary text default null
) returns public.tasks
language plpgsql security definer set search_path = public
as $$
declare v_task public.tasks;
begin
  if not (
    (p_from_status='planning' and p_to_status in ('queued','cancelled','failed')) or
    (p_from_status='queued' and p_to_status in ('running','waiting_device','cancelled','failed','expired')) or
    (p_from_status='running' and p_to_status in ('waiting_approval','waiting_device','paused','completed','partially_completed','failed','cancelled')) or
    (p_from_status='waiting_approval' and p_to_status in ('queued','running','cancelled','failed','expired')) or
    (p_from_status='waiting_device' and p_to_status in ('queued','running','cancelled','failed','expired')) or
    (p_from_status='paused' and p_to_status in ('queued','cancelled'))
  ) then raise exception 'invalid_task_transition' using errcode='22023'; end if;

  update public.tasks set status=p_to_status,
    state_version=state_version+1,
    progress=coalesce(p_progress, progress),
    result_summary=coalesce(p_result_summary, result_summary),
    error_summary=coalesce(p_error_summary, error_summary),
    started_at=case when p_to_status='running' then coalesce(started_at, now()) else started_at end,
    completed_at=case when p_to_status in ('completed','partially_completed','failed','cancelled','expired') then now() else completed_at end,
    updated_at=now()
  where id=p_task_id and owner_id=p_owner_id and status=p_from_status and state_version=p_expected_version
  returning * into v_task;
  if not found then raise exception 'task_transition_conflict' using errcode='40001'; end if;
  return v_task;
end $$;

create or replace function public.consume_approval(
  p_approval_id uuid, p_owner_id uuid, p_action_fingerprint text
) returns public.approvals
language plpgsql security definer set search_path = public
as $$
declare v_approval public.approvals;
begin
  update public.approvals set status='consumed', consumed_at=now()
  where id=p_approval_id and owner_id=p_owner_id and status='approved'
    and action_fingerprint=p_action_fingerprint
    and (expires_at is null or expires_at>now())
  returning * into v_approval;
  if not found then raise exception 'approval_not_consumable' using errcode='42501'; end if;
  return v_approval;
end $$;

create or replace function public.acquire_device_command_lease(
  p_device_id uuid, p_lease_token_hash text, p_lease_seconds integer default 30
) returns public.device_commands
language plpgsql security definer set search_path = public
as $$
declare v_command public.device_commands;
begin
  if p_lease_seconds < 5 or p_lease_seconds > 120 then raise exception 'invalid_lease_duration'; end if;
  select * into v_command from public.device_commands
  where device_id=p_device_id and expires_at>now() and available_at<=now()
    and (status='queued' or (status='leased' and lease_expires_at<=now()))
  order by created_at for update skip locked limit 1;
  if not found then return null; end if;
  if not exists (
    select 1 from public.devices d
    join public.device_capability_grants g on g.device_id=d.id
    where d.id=p_device_id and d.status='online' and d.revoked_at is null
      and g.capability=v_command.capability and g.status='active'
      and (g.expires_at is null or g.expires_at>now())
  ) then return null; end if;
  update public.device_commands set status='leased', attempt_count=attempt_count+1,
    lease_token_hash=p_lease_token_hash,
    lease_expires_at=now()+make_interval(secs=>p_lease_seconds)
  where id=v_command.id returning * into v_command;
  insert into public.device_execution_attempts(owner_id,command_id,device_id,attempt_no,lease_token_hash)
  values(v_command.owner_id,v_command.id,v_command.device_id,v_command.attempt_count,p_lease_token_hash);
  return v_command;
end $$;

revoke all on function public.transition_task(uuid,uuid,text,text,bigint,numeric,text,text) from public, anon, authenticated;
revoke all on function public.consume_approval(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.acquire_device_command_lease(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.transition_task(uuid,uuid,text,text,bigint,numeric,text,text) to service_role;
grant execute on function public.consume_approval(uuid,uuid,text) to service_role;
grant execute on function public.acquire_device_command_lease(uuid,text,integer) to service_role;

commit;
