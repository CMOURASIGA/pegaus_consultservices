'use client'

import type { ReactNode } from 'react'
import { PegasusHeader, usePegasusTheme, type PegasusArea } from './pegasus-header'

type Area = 'home' | 'chat' | 'memory' | 'knowledge' | 'security' | 'sessions'

export function ProductShell({ area, title, eyebrow, children }: { area: Area; title: string; eyebrow: string; children: ReactNode }) {
  const { theme, toggleTheme } = usePegasusTheme()
  const current: PegasusArea = area === 'home' ? 'pegasus' : area === 'chat' ? 'history' : area === 'memory' || area === 'knowledge' ? area : 'account'

  return (
    <main className={`product-shell theme-${theme}`}>
      <PegasusHeader current={current} theme={theme} onToggleTheme={toggleTheme} />
      <section className="product-main"><header className="product-section-header"><div><span>{eyebrow}</span><strong>{title}</strong></div><a href="/app">Voltar ao Pegasus</a></header><div className="product-content">{children}</div></section>
    </main>
  )
}
