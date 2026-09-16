import Link from 'next/link'
import { getVerifiedIdentity } from '../../lib/auth/server'
import { SupabaseMemoryStore } from '../../lib/memory/store'

export const dynamic = 'force-dynamic'

type TaskRow = { id: string; title: string; status: string; priority: string; updated_at: string }

const activeTaskStates = ['planning', 'queued', 'running', 'waiting_external', 'waiting_approval', 'waiting_device', 'paused']
const priorityLabel: Record<string, string> = { critical: 'Crítica', high: 'Alta', normal: 'Normal', low: 'Baixa' }

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export default async function AppPage() {
  const { profile, claims, supabase } = await getVerifiedIdentity()
  const ownerId = claims.sub!
  const memoryStore = new SupabaseMemoryStore(supabase)
  const [taskResult, memoryResult] = await Promise.allSettled([
    supabase.from('tasks').select('id, title, status, priority, updated_at').eq('owner_id', ownerId).in('status', activeTaskStates).order('updated_at', { ascending: false }).limit(5),
    memoryStore.listActive(ownerId, 4),
  ])
  const taskError = taskResult.status === 'rejected' || (taskResult.status === 'fulfilled' && taskResult.value.error)
  const memoryError = memoryResult.status === 'rejected'
  const tasks: TaskRow[] = taskResult.status === 'fulfilled' && !taskResult.value.error ? (taskResult.value.data ?? []) as TaskRow[] : []
  const memories = memoryResult.status === 'fulfilled' ? memoryResult.value : []
  const important = tasks.filter((task) => task.priority === 'critical' || task.priority === 'high')
  const displayName = profile.display_name || 'Christian'

  return (
    <main className="personal-home">
      <header className="home-header">
        <Link className="home-brand" href="/app"><span aria-hidden="true">P</span><strong>Pegasus</strong></Link>
        <nav aria-label="Navegação principal"><Link href="/app/chat">Chat</Link><Link href="/memory">Memória</Link><Link href="/knowledge">Knowledge</Link></nav>
      </header>

      <section className="home-hero">
        <p className="eyebrow">SEU ESPAÇO PESSOAL</p>
        <h1>Olá, {displayName}.</h1>
        <p>Comece pelo que você quer resolver agora. O Pegasus usa apenas o contexto e as informações já registradas por você.</p>
        <div className="home-actions"><Link className="primary-button home-voice-action" href="/app/chat"><span aria-hidden="true">◉</span> Fale com o Pegasus</Link></div>
        <form className="home-text-entry" action="/app/chat" method="get"><label htmlFor="home-message">Ou escreva uma mensagem</label><div><input id="home-message" name="message" maxLength={4000} placeholder="Como posso ajudar?" /><button className="secondary-button" type="submit">Abrir chat</button></div></form>
      </section>

      <section className="home-grid" aria-label="Seu contexto atual">
        <article className="home-card"><header><p className="eyebrow">O QUE IMPORTA AGORA</p><h2>Prioridades registradas</h2></header>
          {taskError ? <p className="home-state error" role="status">Não foi possível consultar as prioridades agora.</p> : important.length === 0 ? <p className="home-state">Nenhuma pendência de alta prioridade registrada neste momento.</p> : <ul className="home-list">{important.map((task) => <li key={task.id}><div><strong>{task.title}</strong><small>Atualizada em {formatDate(task.updated_at)}</small></div><span className="status-pill warning">{priorityLabel[task.priority] ?? task.priority}</span></li>)}</ul>}
        </article>
        <article className="home-card"><header><p className="eyebrow">PENDÊNCIAS</p><h2>Tasks em andamento</h2></header>
          {taskError ? <p className="home-state error" role="status">Não foi possível consultar as pendências agora.</p> : tasks.length === 0 ? <p className="home-state">Nenhuma task aberta foi registrada.</p> : <ul className="home-list">{tasks.map((task) => <li key={task.id}><div><strong>{task.title}</strong><small>{task.status.replaceAll('_', ' ')} · Atualizada em {formatDate(task.updated_at)}</small></div><span className="status-pill">{priorityLabel[task.priority] ?? task.priority}</span></li>)}</ul>}
        </article>
        <article className="home-card home-memory-card"><header><p className="eyebrow">MEMÓRIA RECENTE</p><h2>Contexto que você registrou</h2></header>
          {memoryError ? <p className="home-state error" role="status">Não foi possível consultar a memória agora.</p> : memories.length === 0 ? <p className="home-state">Ainda não há memória relevante registrada. Você pode ensinar algo ao Pegasus no Chat.</p> : <ul className="home-list">{memories.map((memory) => <li key={memory.id}><div><strong>{memory.title || memory.content}</strong><small>Fonte: {memory.source.kind}. Atualizada em {formatDate(memory.updatedAt)}</small></div><Link className="text-link" href="/memory">Ver</Link></li>)}</ul>}
        </article>
      </section>
    </main>
  )
}
