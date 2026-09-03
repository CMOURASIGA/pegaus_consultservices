-- Pegasus - Migration 006: default privileges hardening
-- Goal: prevent future database objects from silently inheriting broad API-role privileges.
-- Explicit GRANTs must be declared by each migration according to its access model.

begin;

-- -----------------------------------------------------------------------------
-- Schema boundary
-- API roles may not create objects in public.
-- authenticated keeps USAGE so explicitly granted tables/functions remain reachable.
-- -----------------------------------------------------------------------------
revoke create on schema public from public, anon, authenticated;
revoke usage on schema public from anon;
grant usage on schema public to authenticated;

-- -----------------------------------------------------------------------------
-- Existing sequences: remove implicit API-role privileges.
-- Current Pegasus tables use UUID identities, so browser roles do not require direct
-- sequence access. Future migrations must grant it explicitly if genuinely needed.
-- -----------------------------------------------------------------------------
revoke all privileges on all sequences in schema public from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Existing functions: PUBLIC receives EXECUTE by PostgreSQL default. Remove that
-- blanket exposure, then explicitly preserve only what is required.
-- set_updated_at is trigger-only and does not need browser invocation.
-- handle_new_auth_user is trigger-only SECURITY DEFINER and must remain private.
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Default privileges for objects created later by the role executing migrations.
-- This prevents new tables/sequences/functions from automatically becoming usable
-- by PUBLIC/anon/authenticated. Each future migration must opt in explicitly.
-- -----------------------------------------------------------------------------
alter default privileges in schema public
  revoke all on tables from public, anon, authenticated;

alter default privileges in schema public
  revoke all on sequences from public, anon, authenticated;

alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Defense in depth: keep audit_events inaccessible from browser roles.
-- -----------------------------------------------------------------------------
revoke all privileges on table public.audit_events from public, anon, authenticated;

commit;
