import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import manifest from './manifest'

describe('Web/PWA chat shell', () => {
  it('provides an installable standalone manifest for the authenticated app', () => {
    const data = manifest()
    expect(data.start_url).toBe('/app')
    expect(data.display).toBe('standalone')
    expect(data.theme_color).toBe('#0b4ea2')
    expect(data.icons?.length).toBeGreaterThan(0)
  })

  it('does not cache authenticated, API, session or chat routes', () => {
    const worker = readFileSync('apps/web/public/sw.js', 'utf8')
    expect(worker).toContain("url.pathname.startsWith('/api/')")
    expect(worker).toContain("url.pathname.startsWith('/app')")
    expect(worker).toContain("url.pathname.startsWith('/auth/')")
  })

  it('includes critical responsive, keyboard and safe-area behavior', () => {
    const styles = readFileSync('apps/web/app/styles.css', 'utf8')
    const shell = readFileSync('apps/web/app/app/chat-shell.tsx', 'utf8')
    expect(styles).toContain('@media (max-width: 767px)')
    expect(styles).toContain('100dvh')
    expect(styles).toContain('env(safe-area-inset-bottom)')
    expect(styles).toContain('max-width: 100vw')
    expect(styles).toContain('overflow-x: hidden')
    expect(styles).toContain('min-width: 0')
    expect(styles).toContain(':focus-visible')
    expect(shell).toContain('aria-live="polite"')
    expect(shell).toContain('<label className="sr-only" htmlFor="message">Mensagem para o Pegasus</label>')
    expect(shell).toContain("event.key === 'Enter' && !event.shiftKey")
    expect(shell).toContain('type="file"')
    expect(shell).toContain('aria-label="Anexar arquivos"')
    expect(shell).toContain('aria-label="Voz disponível em uma próxima etapa"')
  })
})
