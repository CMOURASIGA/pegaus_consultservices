import Link from 'next/link'
import { getVerifiedIdentity } from '../../lib/auth/server'

export const dynamic = 'force-dynamic'

export default async function SessionsPage() {
  const { supabase, claims } = await getVerifiedIdentity()
  const { data: sessions } = await supabase.from('pegasus_sessions')
      .select('auth_session_id, session_kind, trust_level, aal, started_at, last_activity_at, revoked_at, revoke_reason')
      .order('last_activity_at', { ascending: false })
  return (
      <main className="shell">
        <header className="header"><div className="brand"><span className="mark">P</span><div><strong>Pegasus</strong><small>Controle de sessões</small></div></div><Link href="/app">Voltar</Link></header>
        <section className="dashboard">
          <p className="eyebrow">SEGURANÇA</p><h1>Sessões e dispositivos</h1>
          <p className="muted">A revogação individual bloqueia imediatamente o acesso ao Pegasus. O kill switch também solicita ao Supabase a revogação das demais sessões Auth.</p>
          <form action="/auth/revoke" method="post"><input type="hidden" name="scope" value="others" /><button className="danger-button" type="submit">Encerrar todas as outras sessões</button></form>
          <div className="session-list">
            {(sessions ?? []).map((session) => {
              const current = session.auth_session_id === claims.session_id
              return <article className="session-row" key={session.auth_session_id ?? session.started_at}>
                <div><strong>{current ? 'Sessão atual' : 'Sessão Pegasus'}</strong><span>{session.session_kind} · {session.trust_level} · {(session.aal ?? 'aal1').toUpperCase()}</span><small>Última atividade: {new Date(session.last_activity_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</small>{session.revoked_at && <small className="form-error">Revogada</small>}</div>
                {!current && !session.revoked_at && session.auth_session_id && <form action="/auth/revoke" method="post"><input type="hidden" name="target" value={session.auth_session_id} /><button className="link-button" type="submit">Revogar no Pegasus</button></form>}
              </article>
            })}
          </div>
        </section>
      </main>
  )
}
