import { z } from 'zod'
import { getVerifiedIdentity } from '../../../lib/auth/server'
import { SupabaseChatStore } from '../../../lib/chat/store'
import { ChatShell } from '../chat-shell'

export const dynamic = 'force-dynamic'

export default async function VoicePage({ searchParams }: { searchParams: Promise<{ conversation?: string }> }) {
  const { profile, claims, supabase } = await getVerifiedIdentity()
  const requested = await searchParams
  const conversationId = z.uuid().safeParse(requested.conversation).success ? requested.conversation : undefined
  const store = new SupabaseChatStore(supabase)
  const [conversations, activeConversation] = await Promise.all([store.listConversations(claims.sub!), conversationId ? store.getConversation(claims.sub!, conversationId) : Promise.resolve(null)])
  const messages = activeConversation ? await store.listMessages(claims.sub!, activeConversation.id) : []
  return <ChatShell displayName={profile.display_name || 'Christian'} conversations={conversations} activeConversation={activeConversation} initialMessages={messages} initialVoiceIntent voiceSurface />
}
