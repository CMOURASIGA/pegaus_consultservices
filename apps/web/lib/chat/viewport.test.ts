import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { composerHeight, isNearConversationEnd } from './viewport'

describe('chat viewport behavior', () => {
  it.each([
    { name: '1366x768', clientHeight: 696 },
    { name: '1920x1080', clientHeight: 1008 },
    { name: 'ultrawide', clientHeight: 1368 },
    { name: 'mobile 390x844', clientHeight: 782 },
  ])('follows new messages at the end on $name', ({ clientHeight }) => {
    expect(isNearConversationEnd({ scrollHeight: clientHeight + 80, scrollTop: 80, clientHeight })).toBe(true)
  })

  it('does not force the reader away from earlier messages', () => {
    expect(isNearConversationEnd({ scrollHeight: 2400, scrollTop: 400, clientHeight: 700 })).toBe(false)
  })

  it('grows multiline input to a limit and then uses internal scrolling', () => {
    expect(composerHeight(28)).toBe(44)
    expect(composerHeight(96)).toBe(96)
    expect(composerHeight(420)).toBe(160)
  })

  it('keeps the structural CSS contract for few and many messages', () => {
    const css = readFileSync('apps/web/app/styles.css', 'utf8')
    expect(css).toContain('.conversation-workspace { min-width: 0; min-height: 0; display: grid; grid-template-rows: minmax(0, 1fr) auto; overflow: hidden; }')
    expect(css).toContain('justify-content: flex-end')
    expect(css).toContain('overflow-y: auto')
    expect(css).toContain('height: 100dvh')
    expect(css).toContain('env(safe-area-inset-bottom)')
    const composerRules = [...css.matchAll(/\.composer-wrap\s*\{([^}]*)\}/g)].map((match) => match[1])
    expect(composerRules).not.toHaveLength(0)
    expect(composerRules.every((rule) => !rule?.includes('position: fixed'))).toBe(true)
  })
})
