import { getVerifiedIdentity } from '../../lib/auth/server'
import { ProductShell } from '../product-shell'

export const dynamic = 'force-dynamic'

export default async function SessionsPage() {
  const { supabase, claims } = await getVerifiedIdentity()
  const { data: sessions } = await supabase.from('pegasus_sessions')
      .select('auth_session_id, session_kind, trust_level, aal, started_at, last_activity_at, revoked_at, revoke_reason')
      .order('last_activity_at', { ascending: false })
  return (
      <ProductShell area="sessions" eyebrow="CONTA" title="Sessões">
        <section className="settings-page">
          <div className="settings-heading"><p className="eyebrow">ACESSOS ATIVOS</p><h1>Onde sua conta está conectada</h1><p className="muted">Consulte os acessos recentes e encerre aqueles que você não reconhece ou não utiliza mais.</p></div>
          <section className="settings-callout"><div><strong>Proteja sua conta em outros dispositivos</strong><p>Use esta opção se você acessou o Pegasus em outro dispositivo ou suspeita que sua conta permaneceu conectada.</p></div><form action="/auth/revoke" method="post"><input type="hidden" name="scope" value="others" /><button className="danger-button" type="submit">Encerrar outras sessões</button></form></section>
          <div className="session-list">
            {(sessions ?? []).map((session) => {
              const current = session.auth_session_id === claims.session_id
              return <article className="session-row" key={session.auth_session_id ?? session.started_at}>
                <div><strong>{current ? 'Este dispositivo' : 'Outro acesso'}</strong><span>{current ? 'Você está usando esta sessão agora' : 'Sessão conectada à sua conta'}</span><small>Última atividade em {new Date(session.last_activity_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</small>{session.revoked_at ? <small className="form-error">Acesso encerrado</small> : null}<details><summary>Detalhes técnicos</summary><small>{session.session_kind} · {session.trust_level} · {(session.aal ?? 'aal1').toUpperCase()}</small></details></div>
                {!current && !session.revoked_at && session.auth_session_id ? <form action="/auth/revoke" method="post"><input type="hidden" name="target" value={session.auth_session_id} /><button className="link-button" type="submit">Encerrar acesso</button></form> : null}
              </article>
            })}
          </div>
        </section>
      </ProductShell>
  )
}
