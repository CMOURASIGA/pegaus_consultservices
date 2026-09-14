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
    (p_from_status='waiting_external' and p_to_status in ('queued','running','cancelled','failed','expired')) or
    (p_from_status='waiting_approval' and p_to_status in ('queued','running','cancelled','failed','expired')) or
    (p_from_status='waiting_device' and p_to_status in ('queued','running','cancelled','failed','expired')) or
    (p_from_status='paused' and p_to_status in ('queued','cancelled'))
  ) then raise exception 'invalid_task_transition' using errcode='22023'; end if;

  if p_to_status='completed' and not exists (
    select 1 from public.device_commands c
    join public.device_command_results r on r.command_id=c.id
    where c.task_id=p_task_id and c.owner_id=p_owner_id and r.status='completed'
  ) then raise exception 'validated_result_required' using errcode='23514'; end if;

  select * into v_task from public.tasks
  where id=p_task_id and owner_id=p_owner_id
  for update;
  if not found then raise exception 'task_scope_invalid' using errcode='42501'; end if;
  if v_task.status<>p_from_status or v_task.state_version<>p_expected_version then
    raise exception 'task_transition_conflict' using errcode='40001';
  end if;

  update public.tasks as t set status=p_to_status,
    state_version=t.state_version+1,
    progress=coalesce(p_progress, t.progress),
    result_summary=coalesce(p_result_summary, t.result_summary),
    error_summary=coalesce(p_error_summary, t.error_summary),
    started_at=case when p_to_status='running' then coalesce(t.started_at, now()) else t.started_at end,
    completed_at=case when p_to_status in ('completed','partially_completed','failed','cancelled','expired') then now() else t.completed_at end,
    updated_at=now()
  where t.id=p_task_id and t.owner_id=p_owner_id
  returning t.* into v_task;
  return v_task;
end $$;

-- Registered operation. Model text can never create a new operation.
insert into public.tools(tool_key,name,description,risk_level,status)
values ('device.filesystem','Device filesystem','Allowlisted device filesystem operations','medium','active')
on conflict (tool_key) do update set name=excluded.name, description=excluded.description,
  risk_level=excluded.risk_level, status=excluded.status, updated_at=now();

insert into public.tool_capabilities(tool_id,capability_key,operation,approval_level,metadata)
select id,'filesystem.list','filesystem.list','approval','{"protocolVersion":1,"structuredOnly":true}'::jsonb
from public.tools where tool_key='device.filesystem'
on conflict (tool_id,capability_key,operation) do update
set approval_level=excluded.approval_level, metadata=excluded.metadata;

alter table public.device_capability_grants
  add constraint device_capability_grants_expiry_check
  check (expires_at is null or expires_at > granted_at);
alter table public.device_commands
  add constraint device_commands_expiry_check check (expires_at > created_at);

create or replace function public.request_device_action_approval(
  p_owner_id uuid, p_task_id uuid, p_device_id uuid, p_capability text,
  p_target text, p_action_type text, p_action_payload jsonb,
  p_action_fingerprint text, p_approval_level text, p_risk_level text,
  p_expires_at timestamptz, p_correlation_id uuid
) returns public.approvals
language plpgsql security definer set search_path = public
as $$
declare v_item_id uuid; v_approval public.approvals;
begin
  if p_expires_at <= now() then raise exception 'approval_expiry_invalid' using errcode='22023'; end if;
  if not exists(select 1 from public.tasks where id=p_task_id and owner_id=p_owner_id) or
     not exists(select 1 from public.devices where id=p_device_id and owner_id=p_owner_id and status<>'revoked') then
    raise exception 'approval_scope_invalid' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.tool_capabilities tc join public.tools t on t.id=tc.tool_id
    where tc.capability_key=p_capability and tc.operation=p_action_type and t.status='active'
  ) then raise exception 'operation_not_registered' using errcode='42501'; end if;

  insert into public.decision_inbox_items(owner_id,task_id,title,description,priority,risk_level,recommended_action)
  values(p_owner_id,p_task_id,'Aprovação de ação no dispositivo',
    'Revise dispositivo, capability, destino e parâmetros antes de aprovar.',
    case when p_risk_level in ('high','critical') then 'high' else 'normal' end,
    p_risk_level,'approve_or_reject') returning id into v_item_id;

  insert into public.approvals(owner_id,decision_item_id,task_id,device_id,capability,target,
    action_type,action_payload,action_fingerprint,approval_level,expires_at)
  values(p_owner_id,v_item_id,p_task_id,p_device_id,p_capability,p_target,p_action_type,
    p_action_payload,p_action_fingerprint,p_approval_level,p_expires_at)
  returning * into v_approval;

  insert into public.audit_events(owner_id,actor_type,action,target_type,target_ref,outcome,
    risk_level,correlation_id,metadata)
  values(p_owner_id,'system','approval.requested','approval',v_approval.id::text,'success',
    case when p_risk_level in ('high','critical') then 'important' else 'attention' end,
    p_correlation_id,jsonb_build_object('taskId',p_task_id,'deviceId',p_device_id,'capability',p_capability));
  return v_approval;
end $$;

create or replace function public.decide_device_action_approval(
  p_approval_id uuid, p_owner_id uuid, p_decision text
) returns public.approvals
language plpgsql security definer set search_path = public
as $$
declare v_approval public.approvals;
begin
  if p_decision not in ('approved','rejected') then raise exception 'invalid_approval_decision' using errcode='22023'; end if;
  update public.approvals set status=p_decision,
    approved_at=case when p_decision='approved' then now() else approved_at end
  where id=p_approval_id and owner_id=p_owner_id and status='pending'
    and (expires_at is null or expires_at>now())
  returning * into v_approval;
  if not found then raise exception 'approval_not_decidable' using errcode='42501'; end if;
  update public.decision_inbox_items set status=p_decision, resolved_at=now()
  where id=v_approval.decision_item_id and owner_id=p_owner_id;
  insert into public.approval_events(owner_id,approval_id,event_type,actor_type)
  values(p_owner_id,p_approval_id,p_decision,'owner');
  return v_approval;
end $$;

create or replace function public.revoke_device_action_approval(
  p_approval_id uuid, p_owner_id uuid
) returns public.approvals
language plpgsql security definer set search_path = public
as $$
declare v_approval public.approvals;
begin
  update public.approvals set status='revoked'
  where id=p_approval_id and owner_id=p_owner_id and status in ('pending','approved')
  returning * into v_approval;
  if not found then raise exception 'approval_not_revocable' using errcode='42501'; end if;
  insert into public.approval_events(owner_id,approval_id,event_type,actor_type)
  values(p_owner_id,p_approval_id,'revoked','owner');
  return v_approval;
end $$;

create or replace function public.create_authorized_device_command(
  p_owner_id uuid, p_task_id uuid, p_device_id uuid, p_approval_id uuid,
  p_capability text, p_operation text, p_target text, p_parameters jsonb,
  p_action_fingerprint text, p_idempotency_key text, p_command_nonce_hash text,
  p_expires_at timestamptz, p_correlation_id uuid
) returns table(command jsonb, created boolean)
language plpgsql security definer set search_path = public
as $$
declare
  v_approval public.approvals; v_command public.device_commands;
  v_approval_level text; v_existing public.device_commands;
begin
  if p_expires_at<=now() then raise exception 'command_expired' using errcode='22023'; end if;
  select tc.approval_level into v_approval_level
  from public.tool_capabilities tc join public.tools t on t.id=tc.tool_id
  where tc.capability_key=p_capability and tc.operation=p_operation and t.status='active';
  if not found then raise exception 'operation_not_registered' using errcode='42501'; end if;

  if not exists(select 1 from public.tasks where id=p_task_id and owner_id=p_owner_id
    and status in ('queued','running','waiting_approval','waiting_device')) then
    raise exception 'task_not_dispatchable' using errcode='42501'; end if;
  if not exists(select 1 from public.devices where id=p_device_id and owner_id=p_owner_id
    and status<>'revoked' and revoked_at is null and capabilities ? p_capability) then
    raise exception 'device_not_capable' using errcode='42501'; end if;
  if not exists(select 1 from public.device_capability_grants where owner_id=p_owner_id
    and device_id=p_device_id and capability=p_capability and status='active'
    and (expires_at is null or expires_at>now())) then
    raise exception 'capability_not_granted' using errcode='42501'; end if;

  select * into v_existing from public.device_commands
  where owner_id=p_owner_id and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.action_fingerprint<>p_action_fingerprint then
      raise exception 'idempotency_fingerprint_conflict' using errcode='23505';
    end if;
    return query select to_jsonb(v_existing),false; return;
  end if;

  if v_approval_level<>'none' then
    select * into v_approval from public.approvals
    where id=p_approval_id and owner_id=p_owner_id and task_id=p_task_id
      and device_id=p_device_id and capability=p_capability and target=p_target
      and action_type=p_operation and action_payload=p_parameters
      and action_fingerprint=p_action_fingerprint and status='approved'
      and (expires_at is null or expires_at>now())
    for update;
    if not found then raise exception 'approval_not_consumable' using errcode='42501'; end if;
    update public.approvals set status='consumed',consumed_at=now() where id=v_approval.id;
    insert into public.approval_events(owner_id,approval_id,event_type,actor_type)
    values(p_owner_id,v_approval.id,'consumed','system');
  elsif p_approval_id is not null then
    raise exception 'unexpected_approval' using errcode='22023';
  end if;

  insert into public.device_commands(owner_id,task_id,device_id,approval_id,idempotency_key,
    capability,operation,target,parameters,action_fingerprint,command_nonce_hash,
    expires_at,correlation_id)
  values(p_owner_id,p_task_id,p_device_id,p_approval_id,p_idempotency_key,p_capability,
    p_operation,p_target,p_parameters,p_action_fingerprint,p_command_nonce_hash,
    p_expires_at,p_correlation_id)
  returning * into v_command;

  insert into public.audit_events(owner_id,actor_type,action,target_type,target_ref,outcome,
    risk_level,correlation_id,metadata)
  values(p_owner_id,'system','device.command.authorized','device_command',v_command.id::text,
    'success','attention',p_correlation_id,
    jsonb_build_object('taskId',p_task_id,'deviceId',p_device_id,'capability',p_capability));
  return query select to_jsonb(v_command),true;
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
    and attempt_count<max_attempts
    and (status='queued' or (status='leased' and lease_expires_at<=now()))
  order by created_at for update skip locked limit 1;
  if not found then return null; end if;
  if not exists (
    select 1 from public.devices d join public.device_capability_grants g on g.device_id=d.id
    where d.id=p_device_id and d.status='online' and d.revoked_at is null
      and g.owner_id=d.owner_id and g.capability=v_command.capability and g.status='active'
      and (g.expires_at is null or g.expires_at>now())
  ) then return null; end if;
  update public.device_commands set status='leased',attempt_count=attempt_count+1,
    lease_token_hash=p_lease_token_hash,lease_expires_at=now()+make_interval(secs=>p_lease_seconds)
  where id=v_command.id returning * into v_command;
  insert into public.device_execution_attempts(owner_id,command_id,device_id,attempt_no,lease_token_hash)
  values(v_command.owner_id,v_command.id,v_command.device_id,v_command.attempt_count,p_lease_token_hash);
  return v_command;
end $$;

revoke all on function public.transition_task(uuid,uuid,text,text,bigint,numeric,text,text) from public,anon,authenticated;
revoke all on function public.request_device_action_approval(uuid,uuid,uuid,text,text,text,jsonb,text,text,text,timestamptz,uuid) from public,anon,authenticated;
revoke all on function public.decide_device_action_approval(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.revoke_device_action_approval(uuid,uuid) from public,anon,authenticated;
revoke all on function public.create_authorized_device_command(uuid,uuid,uuid,uuid,text,text,text,jsonb,text,text,text,timestamptz,uuid) from public,anon,authenticated;
revoke all on function public.acquire_device_command_lease(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.transition_task(uuid,uuid,text,text,bigint,numeric,text,text) to service_role;
grant execute on function public.request_device_action_approval(uuid,uuid,uuid,text,text,text,jsonb,text,text,text,timestamptz,uuid) to service_role;
grant execute on function public.decide_device_action_approval(uuid,uuid,text) to service_role;
grant execute on function public.revoke_device_action_approval(uuid,uuid) to service_role;
grant execute on function public.create_authorized_device_command(uuid,uuid,uuid,uuid,text,text,text,jsonb,text,text,text,timestamptz,uuid) to service_role;
grant execute on function public.acquire_device_command_lease(uuid,text,integer) to service_role;

commit;
