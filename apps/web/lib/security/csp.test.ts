import { describe, expect, it } from 'vitest'
import { createContentSecurityPolicy } from './csp'

describe('content security policy', () => {
  it('authorizes Next.js hydration with a request nonce without unsafe inline scripts', () => {
    const policy = createContentSecurityPolicy('request-nonce')

    expect(policy).toContain("script-src 'self' 'nonce-request-nonce' 'strict-dynamic'")
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'")
    expect(policy).toContain("connect-src 'self' https://*.supabase.co wss://*.supabase.co")
  })
})
