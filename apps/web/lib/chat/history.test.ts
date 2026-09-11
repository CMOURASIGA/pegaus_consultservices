import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('conversation context boundary', () => {
  it('filters history by both owner and conversation and keeps a small candidate window', () => {
    const source = readFileSync(new URL('./history.ts', import.meta.url), 'utf8')
    expect(source).toContain(".eq('owner_id', ownerId)")
    expect(source).toContain(".eq('conversation_id', conversationId)")
    expect(source).toContain('.limit(16)')
    expect(source).not.toContain('service_role')
  })
})
