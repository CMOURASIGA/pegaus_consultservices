import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('knowledge server boundary', () => {
  it('keeps Drive and persistence adapters server-only', () => {
    for (const file of ['apps/web/lib/knowledge/google-drive.ts', 'apps/web/lib/knowledge/store.ts']) {
      const source = readFileSync(file, 'utf8')
      expect(source.startsWith("import 'server-only'")).toBe(true)
      expect(source).not.toContain('NEXT_PUBLIC_GOOGLE')
      expect(source).not.toMatch(/console\.(log|info|warn|error)/)
    }
  })

  it('requires explicit ownership on persisted document operations', () => {
    const source = readFileSync('apps/web/lib/knowledge/store.ts', 'utf8')
    expect(source).toContain('owner_id: document.ownerId')
    expect(source).toContain(".eq('owner_id', ownerId)")
    expect(source).not.toContain('service-token')
  })
})
