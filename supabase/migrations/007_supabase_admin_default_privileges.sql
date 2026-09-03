-- Pegasus - Migration 007: Supabase-managed creator default privileges hardening
-- Migration 006 hardened defaults for the role executing the SQL (postgres).
-- Supabase also maintains defaults for supabase_admin. This migration explicitly
-- removes automatic anon/authenticated privileges for future public objects.
-- service_role is intentionally preserved because trusted backend operations use it.

begin;

-- Future tables created by supabase_admin must not be exposed automatically
-- to browser API roles. Each Pegasus migration must explicitly GRANT what it needs.
alter default privileges for role supabase_admin in schema public
  revoke all on tables from anon, authenticated;

-- Same rule for sequences.
alter default privileges for role supabase_admin in schema public
  revoke all on sequences from anon, authenticated;

-- PostgreSQL normally grants EXECUTE on new functions broadly. Prevent future
-- functions created by supabase_admin from becoming callable by browser roles.
alter default privileges for role supabase_admin in schema public
  revoke execute on functions from anon, authenticated;

commit;
