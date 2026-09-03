-- Pegasus - Migration 010: Supabase foundation closure
-- Closes gaps proven by the final Security and Performance Advisor audit.

begin;

-- Recovery-code hashes are backend-only. The Control Center must consume a
-- safe backend summary and must never receive hashes for offline inspection.
drop policy if exists recovery_codes_owner_select on public.recovery_codes;
revoke all privileges on table public.recovery_codes from public, anon, authenticated;

-- Trusted backend operations require explicit object privileges in addition to
-- service_role's RLS bypass. Grant only the operational/backend-managed tables;
-- owner-managed tables continue to use their explicit client access model.
grant usage on schema public to service_role;
grant select, insert, update, delete on table
  public.device_events,
  public.ai_usage,
  public.audit_events,
  public.document_chunks,
  public.integration_capabilities,
  public.granted_permissions,
  public.integration_events,
  public.tools,
  public.tool_capabilities,
  public.skill_versions,
  public.skill_tools,
  public.decision_inbox_items,
  public.approvals,
  public.approval_events,
  public.pegasus_sessions,
  public.device_pairing_challenges,
  public.recovery_codes,
  public.auth_security_events
to service_role;

-- Avoid per-row re-evaluation of auth.uid() in the existing owner policies.
-- Only policies that still contain a direct auth.uid() call are changed.
do $migration$
declare
  p record;
  new_qual text;
  new_check text;
  stmt text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') like '%auth.uid()%'
        or coalesce(with_check, '') like '%auth.uid()%'
      )
      and (
        coalesce(qual, '') not like '%SELECT auth.uid()%'
        or coalesce(with_check, '') not like '%SELECT auth.uid()%'
      )
  loop
    new_qual := case when p.qual is null then null
      else replace(p.qual, 'auth.uid()', '( SELECT auth.uid() AS uid)') end;
    new_check := case when p.with_check is null then null
      else replace(p.with_check, 'auth.uid()', '( SELECT auth.uid() AS uid)') end;

    stmt := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if new_qual is not null then
      stmt := stmt || format(' using (%s)', new_qual);
    end if;
    if new_check is not null then
      stmt := stmt || format(' with check (%s)', new_check);
    end if;
    execute stmt;
  end loop;
end
$migration$;

-- Cover every foreign key reported by the Performance Advisor. These indexes
-- support joins and prevent avoidable full scans during parent update/delete.
create index if not exists idx_ai_usage_conversation_id on public.ai_usage (conversation_id);
create index if not exists idx_ai_usage_task_id on public.ai_usage (task_id);
create index if not exists idx_approval_events_approval_id on public.approval_events (approval_id);
create index if not exists idx_approval_events_owner_id on public.approval_events (owner_id);
create index if not exists idx_approvals_decision_item_id on public.approvals (decision_item_id);
create index if not exists idx_approvals_task_id on public.approvals (task_id);
create index if not exists idx_auth_security_events_device_id on public.auth_security_events (device_id);
create index if not exists idx_auth_security_events_pegasus_session_id on public.auth_security_events (pegasus_session_id);
create index if not exists idx_clients_organization_id on public.clients (organization_id);
create index if not exists idx_clients_owner_id on public.clients (owner_id);
create index if not exists idx_conversations_project_id on public.conversations (project_id);
create index if not exists idx_decision_inbox_items_task_id on public.decision_inbox_items (task_id);
create index if not exists idx_device_events_owner_id on public.device_events (owner_id);
create index if not exists idx_device_pairing_challenges_approved_by_device_id on public.device_pairing_challenges (approved_by_device_id);
create index if not exists idx_device_pairing_challenges_requesting_device_id on public.device_pairing_challenges (requesting_device_id);
create index if not exists idx_document_chunks_owner_id on public.document_chunks (owner_id);
create index if not exists idx_document_versions_owner_id on public.document_versions (owner_id);
create index if not exists idx_documents_project_id on public.documents (project_id);
create index if not exists idx_granted_permissions_capability_id on public.granted_permissions (capability_id);
create index if not exists idx_granted_permissions_integration_id on public.granted_permissions (integration_id);
create index if not exists idx_integration_events_owner_id on public.integration_events (owner_id);
create index if not exists idx_memories_person_id on public.memories (person_id);
create index if not exists idx_memories_project_id on public.memories (project_id);
create index if not exists idx_memories_topic_id on public.memories (topic_id);
create index if not exists idx_memory_relations_owner_id on public.memory_relations (owner_id);
create index if not exists idx_memory_relations_target_memory_id on public.memory_relations (target_memory_id);
create index if not exists idx_memory_sources_owner_id on public.memory_sources (owner_id);
create index if not exists idx_memory_versions_owner_id on public.memory_versions (owner_id);
create index if not exists idx_messages_owner_id on public.messages (owner_id);
create index if not exists idx_skill_tools_owner_id on public.skill_tools (owner_id);
create index if not exists idx_skill_tools_tool_id on public.skill_tools (tool_id);
create index if not exists idx_skill_versions_owner_id on public.skill_versions (owner_id);
create index if not exists idx_task_steps_owner_id on public.task_steps (owner_id);
create index if not exists idx_tasks_conversation_id on public.tasks (conversation_id);
create index if not exists idx_tasks_project_id on public.tasks (project_id);

commit;
