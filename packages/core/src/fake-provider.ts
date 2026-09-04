import type { AiProviderAdapter, ProviderRequest, ProviderResponse } from './contracts'

export type FakeProviderBehavior =
  | { type: 'success'; content: string; usage?: ProviderResponse['usage'] }
  | { type: 'error'; error?: Error }
  | { type: 'timeout' }

export class FakeAiProvider implements AiProviderAdapter {
  readonly calls: ProviderRequest[] = []
  constructor(readonly id: string, private readonly behavior: FakeProviderBehavior, private readonly available = true) {}
  isAvailable() { return this.available }
  async generate(request: ProviderRequest): Promise<ProviderResponse> {
    this.calls.push(request)
    if (this.behavior.type === 'error') throw this.behavior.error ?? new Error('fake provider failure')
    if (this.behavior.type === 'timeout') {
      if (request.signal.aborted) throw request.signal.reason
      return await new Promise((_, reject) => request.signal.addEventListener('abort', () => reject(request.signal.reason), { once: true }))
    }
    return { content: this.behavior.content, finishReason: 'completed', usage: this.behavior.usage }
  }
}
