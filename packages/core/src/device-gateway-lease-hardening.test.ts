import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/013_device_command_lease_execute_hardening.sql', 'utf8')
const signature = 'public.acquire_device_command_lease(uuid,text,text,integer)'

describe('Migration 013 Device Gateway lease execute hardening', () => {
  it('removes every public-facing EXECUTE path and restores only service_role', () => {
    expect(migration).toContain(`revoke execute on function ${signature} from PUBLIC`)
    expect(migration).toContain(`revoke execute on function ${signature} from anon`)
    expect(migration).toContain(`revoke execute on function ${signature} from authenticated`)
    expect(migration).toContain(`grant execute on function ${signature} to service_role`)
  })

  it('contains no unrelated schema or runtime change', () => {
    expect(migration).not.toMatch(/create\s+(table|function|policy|index)/i)
    expect(migration).not.toMatch(/alter\s+table/i)
    expect(migration).not.toMatch(/insert\s+into|update\s+|delete\s+from/i)
  })
})
