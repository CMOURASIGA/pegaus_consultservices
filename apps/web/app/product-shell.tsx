'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'

type Area = 'chat' | 'security' | 'sessions'

const navigation: Array<{ href: string; label: string; area: Area; icon: string }> = [
  { href: '/app', label: 'Conversas', area: 'chat', icon: '◇' },
  { href: '/security/mfa', label: 'Segurança', area: 'security', icon: '○' },
  { href: '/sessions', label: 'Sessões', area: 'sessions', icon: '▣' },
]

export function ProductShell({ area, title, eyebrow, children }: { area: Area; title: string; eyebrow: string; children: ReactNode }) {
  const [navigationOpen, setNavigationOpen] = useState(false)

  return (
    <main className="product-shell">
      <aside className={`product-sidebar ${navigationOpen ? 'is-open' : ''}`}>
        <div className="product-brand"><span className="brand-symbol" aria-hidden="true">P</span><div><strong>Pegasus</strong><small>Consult Services</small></div></div>
        <nav className="product-navigation" aria-label="Navegação principal">
          {navigation.map((item) => <Link className={item.area === area ? 'active' : ''} href={item.href} key={item.area}><span aria-hidden="true">{item.icon}</span>{item.label}</Link>)}
        </nav>
        <div className="product-sidebar-note"><span className="environment-dot" />Ambiente de validação</div>
      </aside>
      {navigationOpen ? <button className="sidebar-backdrop" type="button" aria-label="Fechar navegação" onClick={() => setNavigationOpen(false)} /> : null}
      <section className="product-main">
        <header className="product-header">
          <button className="menu-button" type="button" aria-label="Abrir navegação" aria-expanded={navigationOpen} onClick={() => setNavigationOpen(true)}>☰</button>
          <div><span>{eyebrow}</span><strong>{title}</strong></div>
          <form action="/auth/logout" method="post"><button className="link-button compact" type="submit">Sair</button></form>
        </header>
        <div className="product-content">{children}</div>
      </section>
    </main>
  )
}
