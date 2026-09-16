import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const home = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8')
const chat = readFileSync(new URL('./chat/page.tsx', import.meta.url), 'utf8')
const chatShell = readFileSync(new URL('./chat-shell.tsx', import.meta.url), 'utf8')
const voice = readFileSync(new URL('./voice/page.tsx', import.meta.url), 'utf8')
const shell = readFileSync(new URL('../product-shell.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8')

describe('Personal Home foundation', () => {
  it('uses only owner-scoped persisted tasks and memories', () => {
    expect(home).toContain(".eq('owner_id', ownerId)")
    expect(home).toContain(".in('status', activeTaskStates)")
    expect(home).toContain('SupabaseMemoryStore')
    expect(home).not.toContain(".insert(")
  })

  it('presents human-readable memory and provenance without exposing technical classifiers', () => {
    expect(home).toContain('friendlyMemorySource(memory.source.kind)')
    expect(home).toContain('<strong>{memory.content}</strong>')
    expect(home).not.toContain('memory.title || memory.content')
    expect(home).toContain('Atualizada em {formatDate(memory.updatedAt)}')
  })

  it('keeps the current task rule behind an extensible important-now model', () => {
    expect(home).toContain('type ImportantNowItem')
    expect(home).toContain('buildImportantNowItems(tasks)')
    expect(home).toContain('const importantNow = buildImportantNowItems(tasks)')
  })

  it('keeps chat on its dedicated route and preserves the voice entry point', () => {
    expect(home).toContain('href="/app/voice"')
    expect(chat).toContain('SupabaseChatStore')
    expect(chat).toContain('ChatShell')
    expect(voice).toContain('initialVoiceIntent voiceSurface')
    expect(chatShell).toContain('void startVoice()')
    expect(chatShell).toContain("body.set('timeZone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')")
    expect(shell).toContain("{ href: '/app/chat', label: 'Conversas'")
  })

  it('renders a dedicated voice surface over the same ChatShell persistence flow', () => {
    expect(chatShell).toContain('if (voiceSurface)')
    expect(chatShell).toContain('voice-surface')
    expect(chatShell).toContain("voiceSurface ? '/app/voice' : '/app/chat'")
    expect(voice).toContain('SupabaseChatStore')
  })

  it('has responsive Home rules for small screens', () => {
    expect(styles).toContain('.home-grid')
    expect(styles).toContain('@media (max-width: 767px)')
    expect(styles).toContain('.home-grid { grid-template-columns: 1fr; }')
  })

  it('uses the existing Pegasus app icon instead of a textual mark on Home', () => {
    expect(home).toContain('src="/icon.svg"')
    expect(home).not.toContain('aria-hidden="true">P</span><strong>Pegasus</strong>')
  })
})
