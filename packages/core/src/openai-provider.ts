import type { AiProviderAdapter, ProviderRequest, ProviderResponse } from './contracts'
import { ProviderError } from './provider-error'

type OpenAiResponse = {
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>
  status?: string
  incomplete_details?: { reason?: string }
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number }
  error?: { type?: string; code?: string | null }
}

type OpenAiErrorResponse = { error?: { type?: unknown; code?: unknown } }

function safeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length <= 128 ? value : undefined
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500
}

function outputText(response: OpenAiResponse): string {
  return (response.output ?? [])
    .flatMap((item) => item.type === 'message' ? item.content ?? [] : [])
    .filter((item) => item.type === 'output_text' && typeof item.text === 'string')
    .map((item) => item.text?.trim() ?? '')
    .filter(Boolean)
    .join('\n')
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
    if (!response.ok) {
      let errorBody: OpenAiErrorResponse = {}
      try { errorBody = await response.json() as OpenAiErrorResponse } catch { /* no provider body to classify */ }
      throw new ProviderError({
        code: 'provider_error',
        retryable: isRetryableStatus(response.status),
        httpStatus: response.status,
        providerErrorType: safeString(errorBody.error?.type),
        providerErrorCode: safeString(errorBody.error?.code),
        providerRequestId: safeString(response.headers.get('x-request-id')),
      })
    }
    const result = await response.json() as OpenAiResponse
    const content = outputText(result)
    if (!content) throw new ProviderError({ code: 'provider_error', retryable: false, providerErrorType: 'empty_response' })
    return {
      content,
      finishReason: result.status === 'incomplete' && result.incomplete_details?.reason === 'max_output_tokens' ? 'length' : 'completed',
      usage: result.usage ? {
        inputUnits: result.usage.input_tokens,
        outputUnits: result.usage.output_tokens,
        totalUnits: result.usage.total_tokens,
        unit: 'tokens',
      } : undefined,
      providerMetadata: { httpStatus: response.status, requestId: safeString(response.headers.get('x-request-id')) },
    }
  }
}
