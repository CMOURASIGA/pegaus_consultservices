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
}

export type SendChatInput = {
  actorId: string
  content: string
  conversationId?: string
  signal?: AbortSignal
}

export type SendChatResult = {
  conversation: ChatConversation
  userMessage: ChatMessage
  assistantMessage: ChatMessage
  correlationId: string
  provider: string
  model: string
}

export interface ChatStore {
  listConversations(ownerId: string): Promise<ChatConversation[]>
  getConversation(ownerId: string, conversationId: string): Promise<ChatConversation | null>
  listMessages(ownerId: string, conversationId: string): Promise<ChatMessage[]>
  createConversation(ownerId: string, title: string): Promise<ChatConversation>
  createMessage(input: { ownerId: string; conversationId: string; role: 'user' | 'assistant'; content: string; correlationId: string; provider?: string; model?: string }): Promise<ChatMessage>
}
