-- Pegasus Migration 012: HTTPS Device Gateway atomic operations
-- Not for real-database application before disposable preflight and owner approval.
begin;

create or replace function public.complete_device_pairing(
  p_challenge_id uuid,
  p_token_hash text,
  p_key_id text,
  p_public_key text,
  p_registration_nonce_hash text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_challenge public.device_pairing_challenges;
  v_device public.devices;
  v_identity public.device_agent_identities;
  v_capability text;
  v_correlation_id uuid := gen_random_uuid();
begin
  select * into v_challenge from public.device_pairing_challenges
  where id=p_challenge_id for update;
  if not found or v_challenge.status<>'approved' or v_challenge.token_hash<>p_token_hash
     or v_challenge.expires_at<=now() or v_challenge.consumed_at is not null then
    raise exception 'pairing_not_consumable' using errcode='42501';
  end if;
  if p_public_key is null or length(p_public_key)<64 or p_key_id is null or length(p_key_id)<8 then
    raise exception 'agent_identity_invalid' using errcode='22023';
  end if;

  insert into public.devices(owner_id,friendly_name,device_type,os_name,agent_version,
    trust_level,execution_level,public_key,capabilities,status,paired_at,last_seen_at)
  values(v_challenge.owner_id,
    coalesce(nullif(v_challenge.requested_capabilities->>'friendlyName',''),'Windows PC'),
    'computer',v_challenge.requested_capabilities->>'operatingSystem',
    v_challenge.requested_capabilities->>'agentVersion',v_challenge.requested_trust_level,
    'assist',p_public_key,coalesce(v_challenge.requested_capabilities->'capabilities','[]'::jsonb),
    'offline',now(),null)
  returning * into v_device;

  insert into public.device_agent_identities(owner_id,device_id,key_id,public_key)
  values(v_challenge.owner_id,v_device.id,p_key_id,p_public_key)
  returning * into v_identity;

  insert into public.device_request_nonces(device_id,identity_id,nonce_hash,request_kind,expires_at)
  values(v_device.id,v_identity.id,p_registration_nonce_hash,'pairing',now()+interval '5 minutes');

  for v_capability in select jsonb_array_elements_text(coalesce(v_challenge.requested_capabilities->'capabilities','[]'::jsonb))
  loop
    if exists(select 1 from public.tool_capabilities where capability_key=v_capability) then
      insert into public.device_capability_grants(owner_id,device_id,capability,status)
      values(v_challenge.owner_id,v_device.id,v_capability,'active')
      on conflict(device_id,capability) do nothing;
    end if;
  end loop;

  update public.device_pairing_challenges set status='consumed',consumed_at=now(),requesting_device_id=v_device.id
  where id=v_challenge.id;
  insert into public.device_events(owner_id,device_id,event_type,risk_level,metadata)
  values(v_challenge.owner_id,v_device.id,'pairing_consumed','attention',jsonb_build_object('identityId',v_identity.id));
  insert into public.audit_events(owner_id,actor_type,action,target_type,target_ref,outcome,risk_level,correlation_id,metadata)
  values(v_challenge.owner_id,'device_agent','device.pairing.consumed','device',v_device.id::text,'success','attention',v_correlation_id,
    jsonb_build_object('identityId',v_identity.id));
  return jsonb_build_object('ownerId',v_challenge.owner_id,'deviceId',v_device.id,'identityId',v_identity.id,'correlationId',v_correlation_id);
end $$;

create or replace function public.rotate_device_agent_identity(
  p_owner_id uuid,p_device_id uuid,p_current_key_id text,p_next_key_id text,p_next_public_key text
) returns void
language plpgsql security definer set search_path = public
as $$
declare v_current public.device_agent_identities;
begin
  select * into v_current from public.device_agent_identities
  where owner_id=p_owner_id and device_id=p_device_id and key_id=p_current_key_id and status='active'
    and (valid_until is null or valid_until>now()) for update;
  if not found then raise exception 'identity_not_rotatable' using errcode='42501'; end if;
  update public.device_agent_identities set status='rotated',rotated_at=now(),valid_until=now() where id=v_current.id;
  insert into public.device_agent_identities(owner_id,device_id,key_id,public_key,algorithm)
  values(p_owner_id,p_device_id,p_next_key_id,p_next_public_key,'ECDSA_P256_SHA256');
  update public.devices set public_key=p_next_public_key,updated_at=now() where id=p_device_id and owner_id=p_owner_id and status<>'revoked';
  insert into public.audit_events(owner_id,actor_type,action,target_type,target_ref,outcome,risk_level,metadata)
  values(p_owner_id,'device_agent','device.identity.rotated','device',p_device_id::text,'success','attention',
    jsonb_build_object('previousIdentityId',v_current.id,'nextKeyId',p_next_key_id));
end $$;

create or replace function public.record_device_heartbeat(
  p_identity_id uuid,p_device_id uuid,p_agent_version text,p_os_version text,p_capabilities jsonb
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_identity public.device_agent_identities; v_correlation_id uuid:=gen_random_uuid();
begin
  select * into v_identity from public.device_agent_identities
  where id=p_identity_id and device_id=p_device_id and status='active'
    and (valid_until is null or valid_until>now()) for update;
  if not found then raise exception 'identity_not_active' using errcode='42501'; end if;
  update public.devices set status='online',last_seen_at=now(),agent_version=p_agent_version,
    os_version=p_os_version,capabilities=p_capabilities,updated_at=now()
  where id=p_device_id and owner_id=v_identity.owner_id and status<>'revoked' and revoked_at is null;
  if not found then raise exception 'device_not_active' using errcode='42501'; end if;
  insert into public.device_events(owner_id,device_id,event_type,metadata)
  values(v_identity.owner_id,p_device_id,'heartbeat',jsonb_build_object('agentVersion',p_agent_version));
  insert into public.audit_events(owner_id,actor_type,action,target_type,target_ref,outcome,risk_level,correlation_id,metadata)
  values(v_identity.owner_id,'device_agent','device.heartbeat','device',p_device_id::text,'success','info',v_correlation_id,
    jsonb_build_object('agentVersion',p_agent_version));
  return jsonb_build_object('online',true,'correlationId',v_correlation_id);
end $$;

create or replace function public.record_device_command_receipt(
  p_identity_id uuid,p_device_id uuid,p_command_id uuid,p_attempt_id uuid,
  p_lease_token_hash text,p_command_nonce_hash text,p_receipt_nonce_hash text,p_state text,p_error_code text default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_command public.device_commands; v_attempt public.device_execution_attempts;
begin
  if p_state not in ('accepted','rejected') then raise exception 'receipt_state_invalid' using errcode='22023'; end if;
  if (p_state='accepted' and p_error_code is not null) or (p_state='rejected' and coalesce(length(p_error_code),0)=0)
    then raise exception 'receipt_payload_invalid' using errcode='22023'; end if;
  if not exists(select 1 from public.device_agent_identities where id=p_identity_id and device_id=p_device_id and status='active'
    and (valid_until is null or valid_until>now())) then raise exception 'identity_not_active' using errcode='42501'; end if;
  select * into v_command from public.device_commands where id=p_command_id and device_id=p_device_id for update;
  if not found or v_command.status<>'leased' or v_command.lease_expires_at<=now()
    or v_command.lease_token_hash<>p_lease_token_hash or v_command.command_nonce_hash<>p_command_nonce_hash
    or v_command.expires_at<=now() then
    raise exception 'lease_not_valid' using errcode='42501';
  end if;
  select * into v_attempt from public.device_execution_attempts
  where id=p_attempt_id and command_id=p_command_id and device_id=p_device_id and lease_token_hash=p_lease_token_hash for update;
  if not found or v_attempt.receipt_nonce_hash is not null then raise exception 'receipt_not_valid' using errcode='42501'; end if;
  update public.device_execution_attempts set status=case when p_state='accepted' then 'accepted' else 'rejected' end,
    receipt_nonce_hash=p_receipt_nonce_hash,receipt_at=now(),error_code=p_error_code where id=v_attempt.id;
  update public.device_commands set status=case when p_state='accepted' then 'acknowledged' else 'failed' end where id=v_command.id;
  insert into public.audit_events(owner_id,actor_type,action,target_type,target_ref,outcome,risk_level,correlation_id,metadata)
  values(v_command.owner_id,'device_agent','device.command.receipt','device_command',v_command.id::text,
    case when p_state='accepted' then 'success' else 'denied' end,'attention',v_command.correlation_id,
    jsonb_build_object('attemptId',v_attempt.id,'state',p_state));
  return jsonb_build_object('correlationId',v_command.correlation_id);
end $$;

create or replace function public.record_device_command_result(
  p_identity_id uuid,p_device_id uuid,p_command_id uuid,p_attempt_id uuid,
  p_lease_token_hash text,p_command_nonce_hash text,p_result_nonce_hash text,p_status text,p_output jsonb,
  p_error_code text,p_agent_version text,p_evidence_digest text,p_correlation_id uuid,p_retry boolean
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_command public.device_commands; v_attempt public.device_execution_attempts; v_terminal boolean; v_successful boolean;
begin
  if p_status not in ('completed','failed') then raise exception 'result_state_invalid' using errcode='22023'; end if;
  if jsonb_typeof(coalesce(p_output,'{}'::jsonb))<>'object' or pg_column_size(coalesce(p_output,'{}'::jsonb))>262144
    or coalesce(length(p_agent_version),0)=0
    or (p_status='completed' and p_error_code is not null)
    or (p_status='failed' and coalesce(length(p_error_code),0)=0)
    then raise exception 'result_payload_invalid' using errcode='22023'; end if;
  if not exists(select 1 from public.device_agent_identities where id=p_identity_id and device_id=p_device_id and status='active'
    and (valid_until is null or valid_until>now())) then raise exception 'identity_not_active' using errcode='42501'; end if;
  select * into v_command from public.device_commands where id=p_command_id and device_id=p_device_id for update;
  if not found or v_command.status not in ('leased','acknowledged','running') or v_command.lease_expires_at<=now()
    or v_command.lease_token_hash<>p_lease_token_hash or v_command.command_nonce_hash<>p_command_nonce_hash
    or v_command.correlation_id<>p_correlation_id then
    raise exception 'lease_not_valid' using errcode='42501';
  end if;
  select * into v_attempt from public.device_execution_attempts
  where id=p_attempt_id and command_id=p_command_id and device_id=p_device_id and lease_token_hash=p_lease_token_hash for update;
  if not found or v_attempt.result_nonce_hash is not null then raise exception 'result_not_valid' using errcode='42501'; end if;

  v_terminal := not (p_status='failed' and p_retry and v_command.attempt_count<v_command.max_attempts and v_command.expires_at>now());
  v_successful := p_status='completed';
  update public.device_execution_attempts set status=p_status,result_nonce_hash=p_result_nonce_hash,
    completed_at=now(),error_code=p_error_code where id=v_attempt.id;
  if not v_terminal then
    update public.device_commands set status='queued',available_at=now()+interval '5 seconds',
      lease_token_hash=null,lease_expires_at=null where id=v_command.id;
  else
    insert into public.device_command_results(owner_id,command_id,attempt_id,status,output,error_code,
      evidence_digest,agent_version,correlation_id)
    values(v_command.owner_id,v_command.id,v_attempt.id,p_status,coalesce(p_output,'{}'::jsonb),p_error_code,
      p_evidence_digest,p_agent_version,p_correlation_id);
    update public.device_commands set status=p_status where id=v_command.id;
  end if;
  insert into public.audit_events(owner_id,actor_type,action,target_type,target_ref,outcome,risk_level,correlation_id,metadata)
  values(v_command.owner_id,'device_agent','device.command.result','device_command',v_command.id::text,
    case when v_successful then 'success' when v_terminal then 'failed' else 'retry' end,
    case when v_successful then 'info' else 'attention' end,v_command.correlation_id,
    jsonb_build_object('attemptId',v_attempt.id,'terminal',v_terminal,'retryScheduled',not v_terminal,'errorCode',p_error_code));
  return jsonb_build_object('correlationId',v_command.correlation_id,'taskId',v_command.task_id,
    'terminal',v_terminal,'successful',v_successful);
end $$;

create or replace function public.revoke_device_runtime(p_owner_id uuid,p_device_id uuid,p_reason text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.devices set status='revoked',revoked_at=now(),capabilities='[]'::jsonb,updated_at=now()
  where id=p_device_id and owner_id=p_owner_id and status<>'revoked';
  if not found then raise exception 'device_not_revocable' using errcode='42501'; end if;
  update public.device_agent_identities set status='revoked',revoked_at=now(),valid_until=now()
  where device_id=p_device_id and owner_id=p_owner_id and status='active';
  update public.device_capability_grants set status='revoked',revoked_at=now()
  where device_id=p_device_id and owner_id=p_owner_id and status='active';
  update public.device_commands set status='cancelled',lease_token_hash=null,lease_expires_at=null
  where device_id=p_device_id and owner_id=p_owner_id and status in ('queued','leased','acknowledged','running');
  insert into public.device_events(owner_id,device_id,event_type,risk_level,metadata)
  values(p_owner_id,p_device_id,'revoked','important',jsonb_build_object('reason',p_reason));
  insert into public.audit_events(owner_id,actor_type,action,target_type,target_ref,outcome,risk_level,metadata)
  values(p_owner_id,'user','device.revoked','device',p_device_id::text,'revoked','important',jsonb_build_object('reason',p_reason));
end $$;

-- A stale heartbeat can never retain lease eligibility.
drop function if exists public.acquire_device_command_lease(uuid,text,integer);
create function public.acquire_device_command_lease(
  p_device_id uuid, p_lease_token_hash text, p_command_nonce_hash text, p_lease_seconds integer default 30
) returns public.device_commands
language plpgsql security definer set search_path = public
as $$
declare v_command public.device_commands;
begin
  if p_lease_seconds < 5 or p_lease_seconds > 120 then raise exception 'invalid_lease_duration'; end if;
  if p_lease_token_hash is null or length(p_lease_token_hash)<32 or p_command_nonce_hash is null or length(p_command_nonce_hash)<32
    then raise exception 'invalid_command_credential'; end if;
  if not exists(select 1 from public.devices where id=p_device_id and status='online' and revoked_at is null
    and last_seen_at>now()-interval '90 seconds') then return null; end if;
  select c.* into v_command from public.device_commands c
  where c.device_id=p_device_id and c.expires_at>now() and c.available_at<=now() and c.attempt_count<c.max_attempts
    and (c.status='queued' or (c.status='leased' and c.lease_expires_at<=now()))
    and exists(select 1 from public.device_capability_grants g where g.device_id=p_device_id
      and g.owner_id=c.owner_id and g.capability=c.capability and g.status='active'
      and (g.expires_at is null or g.expires_at>now()))
  order by c.created_at for update of c skip locked limit 1;
  if not found then return null; end if;
  if v_command.status='leased' then
    update public.device_execution_attempts set status='timed_out',completed_at=now(),error_code='lease_expired'
    where command_id=v_command.id and attempt_no=v_command.attempt_count and status='leased';
  end if;
  update public.device_commands set status='leased',attempt_count=attempt_count+1,
    lease_token_hash=p_lease_token_hash,command_nonce_hash=p_command_nonce_hash,
    lease_expires_at=now()+make_interval(secs=>p_lease_seconds)
  where id=v_command.id returning * into v_command;
  insert into public.device_execution_attempts(owner_id,command_id,device_id,attempt_no,lease_token_hash)
  values(v_command.owner_id,v_command.id,v_command.device_id,v_command.attempt_count,p_lease_token_hash);
  insert into public.audit_events(owner_id,actor_type,action,target_type,target_ref,outcome,risk_level,correlation_id,metadata)
  values(v_command.owner_id,'device_agent','device.command.leased','device_command',v_command.id::text,'success','attention',
    v_command.correlation_id,jsonb_build_object('attemptNo',v_command.attempt_count,'leaseExpiresAt',v_command.lease_expires_at));
  return v_command;
end $$;

revoke all on function public.complete_device_pairing(uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.rotate_device_agent_identity(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.record_device_heartbeat(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.record_device_command_receipt(uuid,uuid,uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.record_device_command_result(uuid,uuid,uuid,uuid,text,text,text,text,jsonb,text,text,text,uuid,boolean) from public,anon,authenticated;
revoke all on function public.revoke_device_runtime(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.complete_device_pairing(uuid,text,text,text,text) to service_role;
grant execute on function public.rotate_device_agent_identity(uuid,uuid,text,text,text) to service_role;
grant execute on function public.record_device_heartbeat(uuid,uuid,text,text,jsonb) to service_role;
grant execute on function public.record_device_command_receipt(uuid,uuid,uuid,uuid,text,text,text,text,text) to service_role;
grant execute on function public.record_device_command_result(uuid,uuid,uuid,uuid,text,text,text,text,jsonb,text,text,text,uuid,boolean) to service_role;
grant execute on function public.revoke_device_runtime(uuid,uuid,text) to service_role;
revoke all on function public.acquire_device_command_lease(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.acquire_device_command_lease(uuid,text,text,integer) to service_role;

commit;
