'use client'

import { useState } from 'react'

export function RevokeDeviceButton({ deviceId }: { deviceId: string }) {
  const [busy, setBusy] = useState(false)
  const revoke = async () => {
    if (!confirm('Revogar este computador? Ele precisará de um novo pareamento para voltar a conectar.')) return
    setBusy(true)
    try { await fetch('/api/devices/revoke', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deviceId, reason: 'owner_requested_revocation' }) }); location.reload() } finally { setBusy(false) }
  }
  return <button type="button" className="danger-button" disabled={busy} onClick={revoke}>Revogar acesso</button>
}
