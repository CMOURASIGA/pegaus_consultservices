'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export type PegasusTheme = 'light' | 'dark'
export type PegasusArea = 'pegasus' | 'memory' | 'history' | 'knowledge' | 'account'

export function usePegasusTheme() {
  const [theme, setTheme] = useState<PegasusTheme>('light')

  useEffect(() => {
    const stored = window.localStorage.getItem('pegasus-theme')
    const initialTheme = stored === 'light' || stored === 'dark'
      ? stored
      : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    const frame = window.requestAnimationFrame(() => setTheme(initialTheme))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  function toggleTheme() {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      window.localStorage.setItem('pegasus-theme', next)
      return next
    })
  }

  return { theme, toggleTheme }
}

export function PegasusHeader({ current, theme, onToggleTheme }: { current: PegasusArea; theme: PegasusTheme; onToggleTheme(): void }) {
  const [clock, setClock] = useState('')

  useEffect(() => {
    const update = () => setClock(new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date()))
    const frame = window.requestAnimationFrame(update)
    const timer = window.setInterval(update, 30_000)
    return () => { window.cancelAnimationFrame(frame); window.clearInterval(timer) }
  }, [])

  const links: Array<{ area: PegasusArea; href: string; label: string }> = [
    { area: 'pegasus', href: '/app', label: 'Pegasus' },
    { area: 'memory', href: '/memory', label: 'Memória' },
    { area: 'history', href: '/app/chat', label: 'Histórico' },
    { area: 'knowledge', href: '/knowledge', label: 'Knowledge' },
  ]

  return <header className="digital-home-header"><Link className="digital-brand" href="/app"><Image src="/icon.svg" alt="" width={36} height={36} priority /><strong>Pegasus</strong></Link><nav aria-label="Navegação principal">{links.map((link) => <Link className={current === link.area ? 'active' : ''} href={link.href} key={link.area}>{link.label}</Link>)}</nav><div className="digital-header-actions"><time>{clock}</time><button type="button" onClick={onToggleTheme} aria-label={`Ativar tema ${theme === 'dark' ? 'claro' : 'escuro'}`}>{theme === 'dark' ? '☀' : '☾'}</button><form action="/auth/logout" method="post"><button type="submit">Sair</button></form></div></header>
}
