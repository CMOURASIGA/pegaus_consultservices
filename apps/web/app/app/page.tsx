import { z } from 'zod'
import { getVerifiedIdentity } from '../../lib/auth/server'
import { SupabaseChatStore } from '../../lib/chat/store'
import { SupabaseMemoryStore } from '../../lib/memory/store'
import { ChatShell } from './chat-shell'

export const dynamic = 'force-dynamic'

type TaskRow = { id: string; title: string; status: string; priority: string; updated_at: string }
type ImportantNowItem = { id: string; title: string; detail: string; emphasis: 'high' | 'critical' }

const activeTaskStates = ['planning', 'queued', 'running', 'waiting_external', 'waiting_approval', 'waiting_device', 'paused']
const priorityLabel: Record<string, string> = { critical: 'Crítica', high: 'Alta', normal: 'Normal', low: 'Baixa' }
const taskStatusLabel: Record<string, string> = { planning: 'Em planejamento', queued: 'Na fila', running: 'Em andamento', waiting_external: 'Aguardando retorno externo', waiting_approval: 'Aguardando aprovação', waiting_device: 'Aguardando dispositivo', paused: 'Pausada' }

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function buildImportantNowItems(tasks: readonly TaskRow[]): ImportantNowItem[] {
  return tasks
    .filter((task) => task.priority === 'critical' || task.priority === 'high')
    .map((task) => ({
      id: `task:${task.id}`,
      title: task.title,
      detail: `Task atualizada em ${formatDate(task.updated_at)}`,
      emphasis: task.priority as ImportantNowItem['emphasis'],
    }))
}

function friendlyMemorySource(kind: string) {
  if (kind === 'user_message') return 'Informado por você'
  if (kind === 'user_action') return 'Atualizado por você'
  if (kind === 'conversation') return 'Registrado em conversa'
  return 'Origem registrada'
}

export default async function AppPage({ searchParams }: { searchParams: Promise<{ conversation?: string }> }) {
  const { profile, claims, supabase } = await getVerifiedIdentity()
  const ownerId = claims.sub!
  const requested = await searchParams
  const conversationId = z.uuid().safeParse(requested.conversation).success ? requested.conversation : undefined
  const memoryStore = new SupabaseMemoryStore(supabase)
  const chatStore = new SupabaseChatStore(supabase)
  const [taskResult, memoryResult, conversationsResult, activeConversationResult] = await Promise.allSettled([
    supabase.from('tasks').select('id, title, status, priority, updated_at').eq('owner_id', ownerId).in('status', activeTaskStates).order('updated_at', { ascending: false }).limit(5),
    memoryStore.listActive(ownerId, 4),
    chatStore.listConversations(ownerId),
    conversationId ? chatStore.getConversation(ownerId, conversationId) : Promise.resolve(null),
  ])
  const taskError = taskResult.status === 'rejected' || (taskResult.status === 'fulfilled' && taskResult.value.error)
  const memoryError = memoryResult.status === 'rejected'
  const tasks: TaskRow[] = taskResult.status === 'fulfilled' && !taskResult.value.error ? (taskResult.value.data ?? []) as TaskRow[] : []
  const memories = memoryResult.status === 'fulfilled' ? memoryResult.value : []
  const importantNow = buildImportantNowItems(tasks)
  const displayName = profile.display_name || 'Christian'
  const conversations = conversationsResult.status === 'fulfilled' ? conversationsResult.value : []
  const activeConversation = activeConversationResult.status === 'fulfilled' ? activeConversationResult.value : null
  const messages = activeConversation ? await chatStore.listMessages(ownerId, activeConversation.id) : []

  return (
    <ChatShell
      displayName={displayName}
      conversations={conversations}
      activeConversation={activeConversation}
      initialMessages={messages}
      homeSurface
      homeContext={{
        importantNow: importantNow.map((item) => ({ ...item, label: priorityLabel[item.emphasis] })),
        tasks: tasks.map((task) => ({ id: task.id, title: task.title, detail: `${taskStatusLabel[task.status] ?? 'Status registrado'} · Atualizada em ${formatDate(task.updated_at)}`, label: priorityLabel[task.priority] ?? 'Prioridade registrada' })),
        memories: memories.map((memory) => ({ id: memory.id, content: memory.content, provenance: `${friendlyMemorySource(memory.source.kind)}. Atualizada em ${formatDate(memory.updatedAt)}` })),
        taskError: Boolean(taskError),
        memoryError,
      }}
    />
  )
}
