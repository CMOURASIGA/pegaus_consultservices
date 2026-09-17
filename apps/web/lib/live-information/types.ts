import type { LiveInformationEvidence } from '@pegasus/core'

export type LiveInformationResolution =
  | { status: 'not_applicable' }
  | { status: 'needs_input'; message: string }
  | { status: 'available'; evidence: readonly LiveInformationEvidence[] }
  | { status: 'unavailable'; message: string }

export interface LiveInformationPort {
  resolve(input: { query: string; locale: string; signal?: AbortSignal }): Promise<LiveInformationResolution>
}
