import { describe, expect, it } from 'vitest'
import { readServerConfig } from './index'

describe('server configuration', () => {
  it('rejects public service role variables', () => {
    expect(() => readServerConfig({ NODE_ENV: 'test', NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: 'do-not-expose-this-value' })).toThrow(/never be public/)
  })
  it('requires Supabase public config in production', () => {
    expect(() => readServerConfig({ NODE_ENV: 'production' })).toThrow(/required in production/)
  })
  it('uses cost-safe AI Router defaults without any provider credential', () => {
    const config = readServerConfig({ NODE_ENV: 'test' })
    expect(config.AI_ROUTER_TIMEOUT_MS).toBe(30000)
    expect(config.AI_ROUTER_RETRIES_PER_MODEL).toBe(0)
    expect(config.AI_ROUTER_FALLBACK_ENABLED).toBe(false)
    expect(config.AI_ROUTER_FALLBACK_ALLOW_PAID).toBe(false)
  })
})
