import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const home = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8')
const chat = readFileSync(new URL('./chat/page.tsx', import.meta.url), 'utf8')
const chatShell = readFileSync(new URL('./chat-shell.tsx', import.meta.url), 'utf8')
const voice = readFileSync(new URL('./voice/page.tsx', import.meta.url), 'utf8')
const shell = readFileSync(new URL('../product-shell.tsx', import.meta.url), 'utf8')
const header = readFileSync(new URL('../pegasus-header.tsx', import.meta.url), 'utf8')
const presence = readFileSync(new URL('./digital-presence.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8')
const root = readFileSync(new URL('../page.tsx', import.meta.url), 'utf8')

describe('Personal Home foundation', () => {
  it('uses only owner-scoped persisted tasks and memories', () => {
    expect(home).toContain(".eq('owner_id', ownerId)")
    expect(home).toContain(".in('status', activeTaskStates)")
    expect(home).toContain('SupabaseMemoryStore')
    expect(home).not.toContain(".insert(")
  })

  it('presents human-readable memory and provenance without exposing technical classifiers', () => {
    expect(home).toContain('friendlyMemorySource(memory.source.kind)')
    expect(home).toContain('content: memory.content')
    expect(chatShell).toContain('<strong>{memory.content}</strong>')
    expect(home).not.toContain('memory.title || memory.content')
    expect(home).toContain('Atualizada em ${formatDate(memory.updatedAt)}')
  })

  it('keeps the current task rule behind an extensible important-now model', () => {
    expect(home).toContain('type ImportantNowItem')
    expect(home).toContain('buildImportantNowItems(tasks)')
    expect(home).toContain('const importantNow = buildImportantNowItems(tasks)')
  })

  it('keeps chat on its dedicated route and preserves the voice entry point', () => {
    expect(home).toContain('homeSurface')
    expect(chat).toContain('SupabaseChatStore')
    expect(chat).toContain('ChatShell')
    expect(voice).toContain('voiceSurface />')
    expect(voice).not.toContain('initialVoiceIntent')
    expect(chatShell).toContain('void startVoice()')
    expect(chatShell).toContain("voiceSurface || homeSurface")
    expect(chatShell).toContain("body.set('timeZone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')")
    expect(header).toContain("{ area: 'history', href: '/app/chat', label: 'Histórico' }")
    expect(chatShell).toContain("action=\"/app/chat\"")
    expect(chatShell).toContain("name=\"message\"")
  })

  it('renders a dedicated voice surface over the same ChatShell persistence flow', () => {
    expect(chatShell).toContain('if (voiceSurface)')
    expect(chatShell).toContain('voice-surface')
    expect(chatShell).toContain("voiceSurface ? '/app/voice' : homeSurface ? '/app' : '/app/chat'")
    expect(voice).toContain('SupabaseChatStore')
    expect(chatShell).toContain("'Começar conversa'")
    expect(styles).toContain('.voice-surface { height: 100vh; height: 100dvh; overflow: hidden;')
  })

  it('has responsive Home rules, persisted themes and real visual states', () => {
    expect(styles).toContain('.digital-home.theme-dark')
    expect(styles).toContain('@media (max-width: 760px)')
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)')
    expect(header).toContain("window.localStorage.setItem('pegasus-theme', next)")
    expect(chatShell).toContain("voiceState === 'listening'")
    expect(chatShell).toContain("voiceState === 'speaking'")
    expect(chatShell).toContain("status === 'processing'")
    expect(presence).toContain("'working'")
    expect(presence).toContain("'approval_required'")
    expect(chatShell).not.toContain("visualState = 'working'")
    expect(chatShell).not.toContain("visualState = 'approval_required'")
    expect(chatShell).toContain('setTimeout(() => setBooting(false)')
    expect(chatShell).not.toContain('booting ? null')
  })

  it('uses the existing Pegasus app icon instead of a textual mark on Home', () => {
    expect(header).toContain('src="/icon.svg"')
    expect(presence).toContain('presence-figure')
    expect(presence).not.toContain('src="/icon.svg"')
    expect(home).not.toContain('aria-hidden="true">P</span><strong>Pegasus</strong>')
  })

  it('shares the Pegasus shell across Home, Memory, History and Knowledge', () => {
    expect(shell).toContain('<PegasusHeader')
    expect(chatShell).toContain('<PegasusHeader current="pegasus"')
    expect(chatShell).toContain('<PegasusHeader current="history"')
    expect(header).toContain("href: '/memory'")
    expect(header).toContain("href: '/knowledge'")
    expect(shell).toContain('Voltar ao Pegasus')
  })

  it('routes the root URL according to the authenticated Supabase session', () => {
    expect(root).toContain('supabase.auth.getClaims()')
    expect(root).toContain("claims?.sub ? '/app' : '/login'")
  })
})
