-- Pegasus - Migration 004: Auth -> Profile bootstrap
-- Creates/maintains the public profile associated with a Supabase Auth identity.
-- No user UUID, email, password or credential is hardcoded here.

begin;

-- Trigger function runs as definer because auth.users is managed by Supabase Auth.
-- The search_path is intentionally empty; every object reference is schema-qualified.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Do not expose trigger helper as an RPC-style callable function.
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

-- Recreate deterministically if migration is reapplied in a controlled environment.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Backfill users that existed before this trigger was installed.
insert into public.profiles (id, display_name)
select
  u.id,
  nullif(trim(coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'full_name', '')), '')
from auth.users u
on conflict (id) do nothing;

commit;
