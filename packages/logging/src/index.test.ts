import { describe, expect, it } from 'vitest'
import { redact } from './index'

describe('log redaction', () => {
  it('redacts nested credentials', () => {
    expect(redact({ authorization: 'Bearer value', nested: { apiKey: 'value', status: 'ok' } })).toEqual({ authorization: '[REDACTED]', nested: { apiKey: '[REDACTED]', status: 'ok' } })
  })
})
