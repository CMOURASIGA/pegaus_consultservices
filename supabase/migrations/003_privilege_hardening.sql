-- Pegasus - Migration 003: privilege hardening
-- Removes PostgreSQL privileges inherited/defaulted beyond the application's needs.
-- RLS remains the row-level authorization layer.

begin;

-- Start from a deterministic deny baseline on all current public domain tables.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all tables in schema public from authenticated;

-- Owner-managed tables: authenticated users may perform CRUD, still constrained by RLS.
grant select, insert, update, delete on table
  public.profiles,
  public.people,
  public.projects,
  public.topics,
  public.conversations,
  public.messages,
  public.memories,
  public.memory_versions,
  public.tasks,
  public.task_steps,
  public.devices,
  public.organizations,
  public.clients,
  public.entity_relations,
  public.memory_sources,
  public.memory_relations,
  public.documents,
  public.document_versions,
  public.integrations,
  public.skills
  to authenticated;

-- Read-only from the client. Mutations are reserved for trusted backend/service flows.
grant select on table
  public.device_events,
  public.ai_usage,
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
  public.approval_events
  to authenticated;

-- Audit is backend-only in V1. No direct authenticated/anon access.
revoke all privileges on table public.audit_events from authenticated, anon;

-- Prevent future CREATE in public from API roles.
revoke create on schema public from anon, authenticated;
-- They still need schema USAGE to address explicitly granted objects.
grant usage on schema public to authenticated;
revoke usage on schema public from anon;

commit;
