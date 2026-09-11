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
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ output_text: 'Resposta real.', status: 'completed', usage: { input_tokens: 10, output_tokens: 4, total_tokens: 14 } }), { status: 200 }))
    const provider = new OpenAiProvider('test-key-that-is-long-enough', 800, fetcher)
    await expect(provider.generate(request)).resolves.toEqual({ content: 'Resposta real.', finishReason: 'completed', usage: { inputUnits: 10, outputUnits: 4, totalUnits: 14, unit: 'tokens' } })
    const init = fetcher.mock.calls[0]?.[1]
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: 'gpt-test', max_output_tokens: 800, store: false })
  })

  it('returns a sanitized failure to the router for provider errors', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'secret provider detail' } }), { status: 401 }))
    await expect(new OpenAiProvider('test-key-that-is-long-enough', 800, fetcher).generate(request)).rejects.toThrow('OPENAI_HTTP_401')
  })
})
