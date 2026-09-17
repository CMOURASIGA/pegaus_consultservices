import { getVerifiedIdentity } from '../../lib/auth/server'
import { ProductShell } from '../product-shell'
import { PairingPanel } from './pairing-panel'
import { RevokeDeviceButton } from './revoke-device-button'

export const dynamic = 'force-dynamic'

type Device = { id: string; friendly_name: string; os_name: string | null; agent_version: string | null; status: string; trust_level: string; execution_level: string; last_seen_at: string | null; revoked_at: string | null }
type Grant = { device_id: string; capability: string; status: string; expires_at: string | null }

export default async function DevicesPage() {
  const { supabase } = await getVerifiedIdentity()
  const [{ data: deviceRows }, { data: grantRows }] = await Promise.all([
    supabase.from('devices').select('id,friendly_name,os_name,agent_version,status,trust_level,execution_level,last_seen_at,revoked_at').order('last_seen_at', { ascending: false }),
    supabase.from('device_capability_grants').select('device_id,capability,status,expires_at').eq('status', 'active'),
  ])
  const grants = (grantRows ?? []) as Grant[]; const devices = (deviceRows ?? []) as Device[]
  return <ProductShell area="devices" eyebrow="ACESSO LOCAL" title="Meu computador"><section className="settings-page"><div className="settings-heading"><p className="eyebrow">PEGASUS AGENT</p><h1>Computadores conectados</h1><p className="muted">O Agent só fica online quando está aberto por você. Estar conectado não permite observação contínua nem execução sem autorização.</p></div><PairingPanel /><div className="device-list">{devices.length === 0 ? <section className="settings-card"><strong>Nenhum computador pareado</strong><p className="muted">Gere um código, abra o Pegasus Agent e conclua o pareamento.</p></section> : devices.map(device => <article className="settings-card device-card" key={device.id}><header><div><strong>{device.friendly_name}</strong><p className="muted">{device.os_name ?? 'Sistema não informado'} · Agent {device.agent_version ?? 'não informado'}</p></div><span className={`status-pill ${device.status === 'online' ? 'success' : ''}`}>{device.status === 'online' ? 'Online' : device.status === 'revoked' ? 'Revogado' : 'Offline'}</span></header><p className="muted">Última comunicação: {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString('pt-BR') : 'ainda não houve comunicação'}</p><p className="muted">Nível: {device.trust_level} · Execução: {device.execution_level}</p><p className="muted">Capabilities concedidas: {grants.filter(grant => grant.device_id === device.id).map(grant => grant.capability).join(', ') || 'nenhuma'}</p>{!device.revoked_at ? <RevokeDeviceButton deviceId={device.id} /> : null}</article>)}</div></section></ProductShell>
}
