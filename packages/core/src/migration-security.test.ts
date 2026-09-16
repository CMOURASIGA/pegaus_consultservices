import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/011_device_agent_local_loop.sql', 'utf8')

describe('Migration 011 operational authorization boundary', () => {
  it('removes authenticated operational mutations and leaves owner read policies', () => {
    expect(migration).toContain('revoke insert, update, delete on public.devices, public.tasks, public.task_steps from authenticated')
    expect(migration).toContain('create policy devices_owner_select')
    expect(migration).not.toContain('devices_owner_all on public.devices\nfor all')
  })
  it('keeps privileged functions server-only with fixed search_path', () => {
    for (const name of ['transition_task', 'request_device_action_approval', 'decide_device_action_approval', 'revoke_device_action_approval', 'create_authorized_device_command', 'acquire_device_command_lease']) {
      const functionStart = migration.indexOf(`create or replace function public.${name}`)
      expect(functionStart).toBeGreaterThan(-1)
      expect(migration.slice(functionStart, functionStart + 900)).toContain('security definer set search_path = public')
      expect(migration).toContain(`grant execute on function public.${name}`)
    }
  })
  it('consumes approval and inserts command inside one transaction function', () => {
    const start = migration.indexOf('create or replace function public.create_authorized_device_command')
    const body = migration.slice(start, migration.indexOf('create or replace function public.acquire_device_command_lease', start))
    expect(body).toContain("status='consumed'")
    expect(body).toContain('insert into public.device_commands')
    expect(body.indexOf("status='consumed'")).toBeLessThan(body.indexOf('insert into public.device_commands'))
    expect(body).toContain('action_payload=p_parameters')
    expect(body).toContain('action_fingerprint=p_action_fingerprint')
  })
  it('enforces grants, announced capability, idempotency and completion evidence', () => {
    expect(migration).toContain('public.device_capability_grants')
    expect(migration).toContain('capabilities ? p_capability')
    expect(migration).toContain('unique(owner_id, idempotency_key)')
    expect(migration).toContain('validated_result_required')
  })
})
