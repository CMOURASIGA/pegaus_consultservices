import { describe, expect, it } from 'vitest'
import { readServerConfig } from './index'

describe('server configuration', () => {
  it('rejects public service role variables', () => {
    expect(() => readServerConfig({ NODE_ENV: 'test', NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: 'do-not-expose-this-value' })).toThrow(/never be public/)
  })
  it('requires Supabase public config in production', () => {
    expect(() => readServerConfig({ NODE_ENV: 'production' })).toThrow(/required in production/)
  })
})
