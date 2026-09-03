import Link from 'next/link'
import { getVerifiedIdentity } from '../../lib/auth/server'

export const dynamic = 'force-dynamic'

export default async function AppPage() {
  const { profile, claims } = await getVerifiedIdentity()
  return (
      <main className="shell">
        <header className="header">
          <div className="brand"><span className="mark">P</span><div><strong>Pegasus</strong><small>Sessão protegida</small></div></div>
          <form action="/auth/logout" method="post"><button className="link-button" type="submit">Sair</button></form>
        </header>
        <section className="dashboard">
          <p className="eyebrow">ÁREA PRIVADA</p>
          <h1>Olá, {profile.display_name || 'Christian'}.</h1>
          <p className="muted">Sua identidade foi validada no servidor. Nível atual: <strong>{claims.aal === 'aal2' ? 'AAL2' : 'AAL1'}</strong>.</p>
          <div className="grid auth-grid">
            <Link className="card action-card" href="/security/mfa"><strong>Segurança e TOTP</strong><span>Configurar ou conferir o segundo fator.</span></Link>
            <Link className="card action-card" href="/sessions"><strong>Sessões</strong><span>Consultar e revogar acessos.</span></Link>
          </div>
        </section>
      </main>
  )
}
