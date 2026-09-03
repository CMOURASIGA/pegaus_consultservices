import Link from 'next/link'

const messages: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha inválidos.',
  account_unavailable: 'Esta conta não está disponível para acesso.',
  session_expired: 'Sua sessão expirou. Entre novamente.',
  session_revoked: 'Esta sessão foi encerrada.',
  auth_failed: 'Não foi possível concluir a autenticação.',
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand"><span className="mark">P</span><div><strong>Pegasus</strong><small>Acesso privado</small></div></div>
        <div>
          <p className="eyebrow">AUTENTICAÇÃO</p>
          <h1>Entrar</h1>
          <p className="muted">Use somente uma conta autorizada. O segundo fator será solicitado quando já estiver configurado.</p>
        </div>
        {params.error && <p className="form-error" role="alert">{messages[params.error] ?? messages.auth_failed}</p>}
        <form action="/auth/login" method="post" className="auth-form">
          <input type="hidden" name="next" value={params.next ?? '/app'} />
          <label>E-mail<input name="email" type="email" autoComplete="username" required /></label>
          <label>Senha<input name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
          <button type="submit" className="primary-button">Entrar</button>
        </form>
        <p className="fine-print">Não compartilhe sua senha ou códigos temporários. <Link href="/">Voltar</Link></p>
      </section>
    </main>
  )
}
