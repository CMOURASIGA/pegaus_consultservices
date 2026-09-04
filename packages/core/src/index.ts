import { readPublicConfig, readServerConfig } from '@pegasus/config'
import type { ComponentStatus, HealthComponent, HealthReport } from '@pegasus/shared'

export * from './contracts'
export * from './ai-router'
export * from './fake-provider'
export * from './orchestrator'

export async function checkSupabase(fetcher: typeof fetch = fetch): Promise<HealthComponent> {
  const started = Date.now()
  const config = readPublicConfig()
  if (!config.NEXT_PUBLIC_SUPABASE_URL || !config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return { name: 'supabase', status: 'degraded' }
  try {
    const response = await fetcher(`${config.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD', headers: { apikey: config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(3000), cache: 'no-store',
    })
    return { name: 'supabase', status: response.ok ? 'healthy' : 'unavailable', latencyMs: Date.now() - started }
  } catch { return { name: 'supabase', status: 'unavailable', latencyMs: Date.now() - started } }
}

export async function buildHealthReport(fetcher: typeof fetch = fetch): Promise<HealthReport> {
  const config = readServerConfig()
  const components: HealthComponent[] = [{ name: 'application', status: 'healthy' }, await checkSupabase(fetcher)]
  const status: ComponentStatus = components.some((item) => item.status === 'unavailable') ? 'unavailable' : components.some((item) => item.status === 'degraded') ? 'degraded' : 'healthy'
  return { status, version: config.APP_VERSION, timestamp: new Date().toISOString(), components }
}
