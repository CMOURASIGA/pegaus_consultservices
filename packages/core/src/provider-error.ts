import type { SanitizedRouterError } from './contracts'

export class ProviderError extends Error {
  constructor(public readonly detail: SanitizedRouterError) {
    super(detail.code)
    this.name = 'ProviderError'
  }
}
