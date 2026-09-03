'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '../../../../lib/supabase/browser'

export function MfaChallenge() {
  const router = useRouter()
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('Carregando fator...')

  useEffect(() => {
    createClient().auth.mfa.listFactors().then(({ data }) => {
      const factor = data?.totp.find((item) => item.status === 'verified')
      setFactorId(factor?.id ?? null)
      setMessage(factor ? '' : 'Nenhum fator TOTP verificado foi encontrado.')
    }).catch(() => setMessage('Não foi possível carregar o segundo fator.'))
  }, [])

  async function challenge() {
    if (!factorId || code.length !== 6) return setMessage('Digite o código de 6 dígitos.')
    const supabase = createClient()
    const created = await supabase.auth.mfa.challenge({ factorId })
    if (created.error) return setMessage('Não foi possível iniciar o desafio.')
    const verified = await supabase.auth.mfa.verify({ factorId, challengeId: created.data.id, code })
    if (verified.error) return setMessage('Código inválido ou expirado.')
    const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal.data?.currentLevel !== 'aal2') return setMessage('O segundo fator não elevou a sessão para AAL2.')
    await fetch('/auth/mfa/event', { method: 'POST' })
    router.replace('/app')
    router.refresh()
  }

  return <main className="auth-shell"><section className="auth-card"><div><p className="eyebrow">SEGUNDO FATOR</p><h1>Confirme seu acesso</h1><p className="muted">Digite o código atual do seu aplicativo autenticador.</p></div><div className="auth-form"><label>Código<input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" autoFocus /></label><button className="primary-button" onClick={challenge} disabled={!factorId}>Verificar</button></div>{message && <p className="form-error" role="status">{message}</p>}</section></main>
}
