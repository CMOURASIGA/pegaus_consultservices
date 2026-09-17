'use client'

import { useState } from 'react'

type Challenge = { challengeId: string; pairingToken: string; expiresAt: string }

export function PairingPanel() {
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const requestPairing = async () => {
    setBusy(true); setStatus('')
    try {
      const response = await fetch('/api/devices/pairing/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ friendlyName: 'Meu computador Windows', operatingSystem: 'Windows User Mode', agentVersion: '0.1.0-a4a', requestedCapabilities: ['filesystem.list'], requestedTrust: 'temporary' }) })
      const body = await response.json() as Challenge | { error?: { message?: string } }
      if (!response.ok || !('challengeId' in body)) throw new Error('error' in body ? body.error?.message : 'Não foi possível criar o código.')
      setChallenge(body); setStatus('Código criado. Copie-o para o Pegasus Agent e aprove antes de concluir o pareamento.')
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Não foi possível criar o código.') } finally { setBusy(false) }
  }
  const approve = async () => {
    if (!challenge) return
    setBusy(true); setStatus('')
    try {
      const response = await fetch('/api/devices/pairing/approve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ challengeId: challenge.challengeId, capabilities: ['filesystem.list'] }) })
      if (!response.ok) throw new Error('Não foi possível aprovar este pareamento.')
      setStatus('Pareamento aprovado. Volte ao Agent para concluir. O código expira em cinco minutos e só pode ser usado uma vez.')
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Não foi possível aprovar este pareamento.') } finally { setBusy(false) }
  }
  return <section className="settings-card device-pairing"><div><strong>Parear um computador Windows</strong><p className="muted">O Agent funciona somente com as permissões do usuário Windows. Ele não acessa arquivos, tela, teclado ou aplicativos nesta etapa.</p></div><div className="device-actions"><button className="primary-button" type="button" disabled={busy} onClick={requestPairing}>Gerar código de pareamento</button>{challenge ? <button className="link-button" type="button" disabled={busy} onClick={approve}>Aprovar este computador</button> : null}</div>{challenge ? <div className="pairing-code"><strong>Código temporário</strong><code>{challenge.challengeId}.{challenge.pairingToken}</code><small>Expira em {new Date(challenge.expiresAt).toLocaleTimeString('pt-BR')}</small></div> : null}{status ? <p className={status.startsWith('Não') ? 'form-error' : 'form-success'} role="status">{status}</p> : null}</section>
}
