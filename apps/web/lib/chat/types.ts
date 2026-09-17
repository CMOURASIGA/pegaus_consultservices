export type ChatConversation = {
  id: string
  title: string | null
  updatedAt: string
}

export type ChatMessage = {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  correlationId?: string
  attachments?: ChatAttachment[]
  liveInformation?: { capability: string; provider: string; sourceName: string; sourceUrl: string; observedAt: string; retrievedAt: string; validUntil?: string }[]
}

export type ChatAttachment = { id: string; name: string; mediaType: string; size: number; classification: 'internal' }

export type SendChatInput = {
  actorId: string
  content: string
  conversationId?: string
  signal?: AbortSignal
  attachments?: ChatAttachment[]
  timeZone?: string
}

export type SendChatResult = {
  conversation: ChatConversation
  userMessage: ChatMessage
  assistantMessage: ChatMessage
  correlationId: string
  provider: string
  model: string
  memory: { action: 'persist' | 'discard'; memoryId?: string; reason?: string }
}

export interface ChatStore {
  listConversations(ownerId: string): Promise<ChatConversation[]>
  getConversation(ownerId: string, conversationId: string): Promise<ChatConversation | null>
  listMessages(ownerId: string, conversationId: string): Promise<ChatMessage[]>
  createConversation(ownerId: string, title: string): Promise<ChatConversation>
  getWorkingContext(ownerId: string, conversationId: string): Promise<ConversationWorkingContext | null>
  saveWorkingContext(ownerId: string, conversationId: string, context: ConversationWorkingContext | null): Promise<void>
  createMessage(input: { ownerId: string; conversationId: string; role: 'user' | 'assistant'; content: string; correlationId: string; provider?: string; model?: string; attachments?: ChatAttachment[]; liveInformation?: ChatMessage['liveInformation'] }): Promise<ChatMessage>
}
import type { ConversationWorkingContext } from '@pegasus/core'
