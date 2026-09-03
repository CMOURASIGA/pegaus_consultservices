'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase/browser'

type TotpSetup = { factorId: string; qrCode: string; secret: string; challengeId?: string }

export function MfaManager({ initialAal }: { initialAal: 'aal1' | 'aal2' }) {
  const [factorId, setFactorId] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'unenrolled' | 'enrolled' | 'verified'>('loading')
  const [setup, setSetup] = useState<TotpSetup | null>(null)
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [aal, setAal] = useState(initialAal)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([supabase.auth.mfa.listFactors(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]).then(([factors, level]) => {
      const verified = factors.data?.totp.find((factor) => factor.status === 'verified')
      setFactorId(verified?.id ?? null)
      setStatus(verified ? 'enrolled' : 'unenrolled')
      setAal(level.data?.currentLevel === 'aal2' ? 'aal2' : 'aal1')
    }).catch(() => {
      setMessage('Não foi possível carregar os fatores de segurança.')
      setStatus('unenrolled')
    })
  }, [])

  async function enroll() {
    setMessage('')
    const { data, error } = await createClient().auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Pegasus Authenticator' })
    if (error) return setMessage('Não foi possível iniciar o cadastro do autenticador.')
    setFactorId(data.id)
    setSetup({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
  }

  async function verify() {
    if (!factorId || code.length !== 6) return setMessage('Digite o código de 6 dígitos.')
    const supabase = createClient()
    let challengeId = setup?.challengeId
    if (!challengeId) {
      const challenge = await supabase.auth.mfa.challenge({ factorId })
      if (challenge.error) return setMessage('Não foi possível criar o desafio TOTP.')
      challengeId = challenge.data.id
      if (setup) setSetup({ ...setup, challengeId })
    }
    const result = await supabase.auth.mfa.verify({ factorId, challengeId, code })
    if (result.error) return setMessage('Código inválido ou expirado. Tente novamente.')
    const level = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    setAal(level.data?.currentLevel === 'aal2' ? 'aal2' : 'aal1')
    setStatus('verified')
    setCode('')
    setMessage('Segundo fator validado. A sessão está em AAL2.')
    await fetch('/auth/mfa/event', { method: 'POST' })
  }

  return (
    <main className="auth-shell">
      <section className="auth-card wide-card">
        <div><p className="eyebrow">SEGURANÇA</p><h1>Authenticator TOTP</h1><p className="muted">Nível atual da sessão: <strong>{aal.toUpperCase()}</strong></p></div>
        {status === 'loading' && <p>Carregando fatores...</p>}
        {status === 'unenrolled' && !setup && <><p>Nenhum autenticador foi cadastrado. A sessão continua em AAL1 até você concluir o fluxo.</p><button className="primary-button" onClick={enroll}>Cadastrar autenticador</button></>}
        {setup && <div className="totp-setup">
          <p>Leia o QR Code no Google Authenticator, Microsoft Authenticator ou aplicativo compatível.</p>
          {/* Supabase returns a self-contained SVG data URL, not remote user content. */}
          <Image src={setup.qrCode} width={220} height={220} unoptimized alt="QR Code temporário para cadastro TOTP" />
          <details><summary>Não consegue ler o QR Code?</summary><code className="secret-code">{setup.secret}</code><p className="fine-print">Este segredo aparece apenas durante o cadastro. Não o compartilhe.</p></details>
        </div>}
        {(status === 'enrolled' || setup) && <div className="auth-form"><label>Código de 6 dígitos<input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" /></label><button className="primary-button" onClick={verify}>Validar código</button></div>}
        {status === 'verified' && <p>O fator foi comprovado nesta sessão.</p>}
        {message && <p className={status === 'verified' ? 'form-success' : 'form-error'} role="status">{message}</p>}
        <Link href="/app">Voltar à área privada</Link>
      </section>
    </main>
  )
}
