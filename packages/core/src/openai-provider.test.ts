import { describe, expect, it, vi } from 'vitest'
import { OpenAiProvider } from './openai-provider'

const request = { requestId: 'r1', correlationId: 'c1', model: 'gpt-test', messages: [{ role: 'user' as const, content: 'Olá' }], modality: 'text' as const, signal: new AbortController().signal }

describe('OpenAiProvider', () => {
  it('is unavailable without a credential and never performs a request', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const provider = new OpenAiProvider(undefined, 800, fetcher)
    expect(provider.isAvailable()).toBe(false)
    await expect(provider.generate(request)).rejects.toThrow('OPENAI_NOT_CONFIGURED')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('maps a Responses API result and usage without exposing the key in output', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'Resposta real.' }] }], status: 'completed', usage: { input_tokens: 10, output_tokens: 4, total_tokens: 14 } }), { status: 200 }))
    const provider = new OpenAiProvider('test-key-that-is-long-enough', 800, fetcher)
    await expect(provider.generate(request)).resolves.toEqual({ content: 'Resposta real.', finishReason: 'completed', usage: { inputUnits: 10, outputUnits: 4, totalUnits: 14, unit: 'tokens' } })
    const init = fetcher.mock.calls[0]?.[1]
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: 'gpt-test', max_output_tokens: 800, store: false })
  })

  it('keeps only safe diagnostics from a provider error', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'private prompt and key', type: 'invalid_request_error', code: 'invalid_api_key' } }), { status: 401, headers: { 'x-request-id': 'req_safe123' } }))
    await expect(new OpenAiProvider('test-key-that-is-long-enough', 800, fetcher).generate(request)).rejects.toMatchObject({
      detail: { code: 'provider_error', retryable: false, httpStatus: 401, providerErrorType: 'invalid_request_error', providerErrorCode: 'invalid_api_key', providerRequestId: 'req_safe123' },
    })
  })

  it('classifies rate limits as retryable without retaining the provider message', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'sensitive detail', type: 'rate_limit_error', code: 'slow_down' } }), { status: 429 }))
    try {
      await new OpenAiProvider('test-key-that-is-long-enough', 800, fetcher).generate(request)
      expect.unreachable('provider call should fail')
    } catch (error) {
      expect(error).toMatchObject({ detail: { httpStatus: 429, retryable: true, providerErrorType: 'rate_limit_error', providerErrorCode: 'slow_down' } })
      expect(JSON.stringify(error)).not.toContain('sensitive detail')
    }
  })
})
