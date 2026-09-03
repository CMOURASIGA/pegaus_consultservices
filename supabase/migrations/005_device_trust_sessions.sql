-- Pegasus - Migration 005: device trust + adaptive session foundation
-- Source of truth: docs/01-architecture/AUTHENTICATION_SESSIONS.md
-- Complements Supabase Auth. Does NOT duplicate passwords, JWTs, passkeys or auth.sessions.

begin;

-- -----------------------------------------------------------------------------
-- Extend existing device registry with contextual trust signals.
-- -----------------------------------------------------------------------------
alter table public.devices
  add column if not exists device_class text not null default 'personal'
    check (device_class in ('personal','work','public','shared','unknown')),
  add column if not exists browser_name text,
  add column if not exists browser_version text,
  add column if not exists is_root_of_trust boolean not null default false,
  add column if not exists trust_expires_at timestamptz,
  add column if not exists last_ip_hash text,
  add column if not exists last_user_agent_hash text;

-- At most one active root-of-trust device per owner.
create unique index if not exists uq_devices_owner_root_of_trust
  on public.devices(owner_id)
  where is_root_of_trust = true and status <> 'revoked';

create index if not exists idx_devices_owner_trust
  on public.devices(owner_id, trust_level, status);

-- -----------------------------------------------------------------------------
-- Pegasus application-session metadata.
-- auth.sessions remains the cryptographic session source of truth in Supabase Auth.
-- This table stores only Pegasus risk/trust/context state.
-- -----------------------------------------------------------------------------
create table if not exists public.pegasus_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  auth_session_id uuid,
  device_id uuid references public.devices(id) on delete set null,
  session_kind text not null default 'standard'
    check (session_kind in ('standard','temporary','public_device','recovery')),
  trust_level text not null default 'untrusted'
    check (trust_level in ('untrusted','temporary','trusted')),
  risk_level text not null default 'normal'
    check (risk_level in ('low','normal','elevated','high','critical')),
  aal text check (aal is null or aal in ('aal1','aal2')),
  presence_state text not null default 'unknown'
    check (presence_state in ('unknown','present','absent','changed','locked')),
  privacy_locked boolean not null default false,
  step_up_required boolean not null default false,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  idle_expires_at timestamptz,
  absolute_expires_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pegasus_sessions_owner_active
  on public.pegasus_sessions(owner_id, revoked_at, last_activity_at desc);
create index if not exists idx_pegasus_sessions_device
  on public.pegasus_sessions(device_id, revoked_at);
create unique index if not exists uq_pegasus_sessions_auth_session
  on public.pegasus_sessions(auth_session_id)
  where auth_session_id is not null;

-- -----------------------------------------------------------------------------
-- Short-lived cross-device / QR approval challenges.
-- Never store reusable credentials or raw authentication secrets here.
-- token_hash is a one-way digest of the one-time challenge token.
-- -----------------------------------------------------------------------------
create table if not exists public.device_pairing_challenges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  requesting_device_id uuid references public.devices(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending','approved','denied','consumed','expired','cancelled')),
  requested_trust_level text not null default 'temporary'
    check (requested_trust_level in ('temporary','trusted')),
  requested_capabilities jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  approved_by_device_id uuid references public.devices(id) on delete set null,
  approved_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint device_pairing_expiry_after_creation check (expires_at > created_at)
);

create index if not exists idx_pairing_owner_status_expiry
  on public.device_pairing_challenges(owner_id, status, expires_at);

-- -----------------------------------------------------------------------------
-- Recovery codes. Only hashes are stored. Plain recovery codes must be shown once
-- by trusted backend code and never persisted in DB/logs/analytics.
-- -----------------------------------------------------------------------------
create table if not exists public.recovery_codes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique,
  batch_id uuid not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_recovery_codes_owner_active
  on public.recovery_codes(owner_id, batch_id)
  where used_at is null and revoked_at is null;

-- -----------------------------------------------------------------------------
-- Authentication/security event stream visible to the owner, written by backend.
-- -----------------------------------------------------------------------------
create table if not exists public.auth_security_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  pegasus_session_id uuid references public.pegasus_sessions(id) on delete set null,
  device_id uuid references public.devices(id) on delete set null,
  event_type text not null,
  outcome text not null default 'observed'
    check (outcome in ('observed','success','denied','failed','revoked','locked')),
  risk_level text not null default 'normal'
    check (risk_level in ('low','normal','elevated','high','critical')),
  auth_method text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_auth_security_events_owner_created
  on public.auth_security_events(owner_id, created_at desc);

-- -----------------------------------------------------------------------------
-- updated_at
-- -----------------------------------------------------------------------------
drop trigger if exists trg_pegasus_sessions_updated_at on public.pegasus_sessions;
create trigger trg_pegasus_sessions_updated_at
before update on public.pegasus_sessions
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- Sensitive session/pairing/recovery mutation is backend-only.
-- Owner receives read-only visibility for Control Center.
-- -----------------------------------------------------------------------------
alter table public.pegasus_sessions enable row level security;
alter table public.device_pairing_challenges enable row level security;
alter table public.recovery_codes enable row level security;
alter table public.auth_security_events enable row level security;

drop policy if exists pegasus_sessions_owner_select on public.pegasus_sessions;
create policy pegasus_sessions_owner_select
on public.pegasus_sessions
for select
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists pairing_challenges_owner_select on public.device_pairing_challenges;
create policy pairing_challenges_owner_select
on public.device_pairing_challenges
for select
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists recovery_codes_owner_select on public.recovery_codes;
create policy recovery_codes_owner_select
on public.recovery_codes
for select
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists auth_security_events_owner_select on public.auth_security_events;
create policy auth_security_events_owner_select
on public.auth_security_events
for select
to authenticated
using ((select auth.uid()) = owner_id);

-- -----------------------------------------------------------------------------
-- Deterministic table privileges.
-- No anon access. No direct client mutation of sensitive security state.
-- -----------------------------------------------------------------------------
revoke all privileges on table public.pegasus_sessions from anon, authenticated;
revoke all privileges on table public.device_pairing_challenges from anon, authenticated;
revoke all privileges on table public.recovery_codes from anon, authenticated;
revoke all privileges on table public.auth_security_events from anon, authenticated;

grant select on table public.pegasus_sessions to authenticated;
grant select on table public.device_pairing_challenges to authenticated;
grant select on table public.recovery_codes to authenticated;
grant select on table public.auth_security_events to authenticated;

-- Existing devices table remains owner-managed for now, but root-of-trust elevation,
-- revocation and capability escalation MUST be mediated by backend policy in the app.
-- This will be tightened before production exposure if the frontend no longer needs
-- direct device CRUD.

commit;
