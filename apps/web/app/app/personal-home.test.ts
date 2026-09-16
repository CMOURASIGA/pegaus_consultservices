import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const home = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8')
const chat = readFileSync(new URL('./chat/page.tsx', import.meta.url), 'utf8')
const shell = readFileSync(new URL('../product-shell.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8')

describe('Personal Home foundation', () => {
  it('uses only owner-scoped persisted tasks and memories', () => {
    expect(home).toContain(".eq('owner_id', ownerId)")
    expect(home).toContain(".in('status', activeTaskStates)")
    expect(home).toContain('SupabaseMemoryStore')
    expect(home).not.toContain(".insert(")
  })

  it('presents memory provenance without fabricating a source', () => {
    expect(home).toContain('Fonte: {memory.source.kind}')
    expect(home).toContain('Atualizada em {formatDate(memory.updatedAt)}')
  })

  it('keeps chat on its dedicated route and preserves the voice entry point', () => {
    expect(home).toContain('href="/app/chat"')
    expect(chat).toContain('SupabaseChatStore')
    expect(chat).toContain('ChatShell')
    expect(shell).toContain("{ href: '/app/chat', label: 'Conversas'")
  })

  it('has responsive Home rules for small screens', () => {
    expect(styles).toContain('.home-grid')
    expect(styles).toContain('@media (max-width: 767px)')
    expect(styles).toContain('.home-grid { grid-template-columns: 1fr; }')
  })
})
