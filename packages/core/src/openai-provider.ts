import type { AiProviderAdapter, ProviderRequest, ProviderResponse } from './contracts'

type OpenAiResponse = {
  output_text?: string
  status?: string
  incomplete_details?: { reason?: string }
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number }
  error?: { type?: string }
}

export class OpenAiProvider implements AiProviderAdapter {
  readonly id = 'openai'

  constructor(
    private readonly apiKey: string | undefined,
    private readonly maxOutputTokens: number,
    private readonly request: typeof fetch = fetch,
  ) {}

  isAvailable() { return Boolean(this.apiKey) }

  async generate(input: ProviderRequest): Promise<ProviderResponse> {
    if (!this.apiKey) throw new Error('OPENAI_NOT_CONFIGURED')
    const response = await this.request('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: input.model,
        input: input.messages.map((message) => ({ role: message.role, content: message.content })),
        max_output_tokens: this.maxOutputTokens,
        store: false,
      }),
      signal: input.signal,
    })
    if (!response.ok) throw new Error(`OPENAI_HTTP_${response.status}`)
    const result = await response.json() as OpenAiResponse
    if (!result.output_text?.trim()) throw new Error(`OPENAI_EMPTY_${result.status ?? result.error?.type ?? 'UNKNOWN'}`)
    return {
      content: result.output_text.trim(),
      finishReason: result.status === 'incomplete' && result.incomplete_details?.reason === 'max_output_tokens' ? 'length' : 'completed',
      usage: result.usage ? {
        inputUnits: result.usage.input_tokens,
        outputUnits: result.usage.output_tokens,
        totalUnits: result.usage.total_tokens,
        unit: 'tokens',
      } : undefined,
    }
  }
}
