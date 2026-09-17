import type { ConversationWorkingContext, PendingCapabilityInteraction } from '@pegasus/core'
import type { ChatMessage } from './types'

const MAX_TURNS = 6
const MAX_TURN_CHARS = 800
const MAX_PARAMETER_CHARS = 200

function cleanText(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, MAX_TURN_CHARS)
}

function cleanParameters(input: Record<string, unknown>) {
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input).slice(0, 12)) {
    if (!/^[a-z][a-z0-9_]{0,50}$/iu.test(key)) continue
    if (typeof value === 'string') output[key] = cleanText(value).slice(0, MAX_PARAMETER_CHARS)
    else if (typeof value === 'number' || typeof value === 'boolean' || value === null) output[key] = value
  }
  return output
}

function validPending(pending: PendingCapabilityInteraction | undefined, conversationId: string, now: Date) {
  if (!pending || pending.conversationId !== conversationId || pending.status !== 'pending') return undefined
  if (!Number.isFinite(Date.parse(pending.expiresAt)) || Date.parse(pending.expiresAt) <= now.getTime()) return undefined
  return { ...pending, knownParameters: cleanParameters(pending.knownParameters), missingParameters: pending.missingParameters.filter((item) => typeof item === 'string').slice(0, 10) }
}

export function buildConversationWorkingContext(input: { conversationId: string; messages: readonly ChatMessage[]; stored: ConversationWorkingContext | null; now?: Date }): ConversationWorkingContext {
  const now = input.now ?? new Date()
  const recentTurns = input.messages.slice(-MAX_TURNS).map((message) => ({ role: message.role, content: cleanText(message.content), createdAt: message.createdAt })).filter((message) => message.content)
  const pending = validPending(input.stored?.pending, input.conversationId, now)
  const activeCapability = input.stored?.activeCapability ? { ...input.stored.activeCapability, intent: cleanText(input.stored.activeCapability.intent).slice(0, 120), knownParameters: cleanParameters(input.stored.activeCapability.knownParameters) } : undefined
  return { recentTurns, pending, activeCapability }
}
