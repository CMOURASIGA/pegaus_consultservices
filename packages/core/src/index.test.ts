import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildHealthReport, checkSupabase } from './index'

afterEach(() => vi.unstubAllEnvs())

describe('health', () => {
  it('is degraded when Supabase is not configured in development', async () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', ''); vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '')
    expect((await buildHealthReport()).status).toBe('degraded')
  })
  it('marks Supabase healthy without exposing credentials', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'publishable-key-with-safe-length')
    const fetcher = vi.fn(async () => new Response(null, { status: 200 })) as unknown as typeof fetch
    expect((await checkSupabase(fetcher)).status).toBe('healthy')
  })
})
