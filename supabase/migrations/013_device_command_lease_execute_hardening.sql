-- Pegasus Migration 013: harden the Device Gateway lease RPC.
-- The lease is an internal backend operation and must never be exposed through Data API roles.
begin;

revoke execute on function public.acquire_device_command_lease(uuid,text,text,integer) from PUBLIC;
revoke execute on function public.acquire_device_command_lease(uuid,text,text,integer) from anon;
revoke execute on function public.acquire_device_command_lease(uuid,text,text,integer) from authenticated;
grant execute on function public.acquire_device_command_lease(uuid,text,text,integer) to service_role;

commit;
