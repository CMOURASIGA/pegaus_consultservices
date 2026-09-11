import { describe, expect, it } from 'vitest'
import { readServerConfig } from './index'

describe('server configuration', () => {
  it('rejects public service role variables', () => {
    expect(() => readServerConfig({ NODE_ENV: 'test', NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: 'do-not-expose-this-value' })).toThrow(/never be public/)
    expect(() => readServerConfig({ NODE_ENV: 'test', NEXT_PUBLIC_OPENAI_API_KEY: 'do-not-expose-this-value' })).toThrow(/never be public/)
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
    expect(config.OPENAI_API_KEY).toBeUndefined()
    expect(config.PEGASUS_AI_PROVIDER).toBe('fake')
    expect(config.PEGASUS_AI_MODEL).toBe('gpt-5.6-luna')
    expect(config.PEGASUS_AI_MAX_OUTPUT_TOKENS).toBe(800)
  })
  it('accepts an explicitly configured OpenAI model with a bounded output', () => {
    const config = readServerConfig({ NODE_ENV: 'test', PEGASUS_AI_PROVIDER: 'openai', PEGASUS_AI_MODEL: 'gpt-test', PEGASUS_AI_MAX_OUTPUT_TOKENS: '400' })
    expect(config).toMatchObject({ PEGASUS_AI_PROVIDER: 'openai', PEGASUS_AI_MODEL: 'gpt-test', PEGASUS_AI_MAX_OUTPUT_TOKENS: 400 })
    expect(() => readServerConfig({ NODE_ENV: 'test', PEGASUS_AI_MAX_OUTPUT_TOKENS: '9000' })).toThrow(/Invalid server/)
  })
})
