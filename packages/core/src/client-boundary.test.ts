import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('frontend privilege boundary', () => {
  it('does not expose the Core or server configuration through client components', () => {
    const clientFiles = execFileSync('git', ['ls-files', 'apps/web']).toString('utf8').trim().split('\n').filter((file) => file.endsWith('.ts') || file.endsWith('.tsx')).filter((file) => readFileSync(file, 'utf8').startsWith("'use client'"))
    for (const file of clientFiles) {
      const source = readFileSync(file, 'utf8')
      expect(source).not.toMatch(/@pegasus\/core|readServerConfig|SUPABASE_SERVICE_ROLE_KEY|AI_ROUTER_/)
    }
  })
})
