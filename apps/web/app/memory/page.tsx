import { getVerifiedIdentity } from '../../lib/auth/server'
import { SupabaseMemoryStore } from '../../lib/memory/store'
import { ProductShell } from '../product-shell'

export const dynamic = 'force-dynamic'

const typeLabel: Record<string, string> = {
  episodic: 'Acontecimento', semantic: 'Informação', decision: 'Decisão', working_profile: 'Preferência', project: 'Projeto', relationship: 'Relacionamento',
}

export default async function MemoryPage({ searchParams }: { searchParams: Promise<{ updated?: string }> }) {
  const { claims, supabase } = await getVerifiedIdentity()
  const memories = await new SupabaseMemoryStore(supabase).list(claims.sub!)
  const updated = (await searchParams).updated === '1'

  return (
    <ProductShell area="memory" eyebrow="CONHECIMENTO PESSOAL" title="Memória">
      <div className="settings-page">
        <div className="settings-heading"><p className="eyebrow">MEMÓRIA SELETIVA</p><h1>O que o Pegasus lembra</h1><p className="muted">Somente informações consideradas úteis ou que você pediu explicitamente para guardar. Você pode corrigir ou arquivar cada item.</p></div>
        {updated ? <p className="form-success" role="status">Memória atualizada.</p> : null}
        {memories.length === 0 ? <section className="settings-card"><strong>Nenhuma memória registrada</strong><p className="muted">No Chat, use uma frase como: “Lembre que prefiro revisar a especificação antes do código”.</p></section> : <div className="memory-list">{memories.map((memory) => (
          <article className={`memory-card ${memory.status !== 'active' ? 'is-archived' : ''}`} key={memory.id}>
            <header><div><span>{typeLabel[memory.type] ?? 'Memória'}</span><strong>{memory.authority === 'explicit_user' ? 'Ensinado por você' : 'Identificado pelo Pegasus'}</strong></div><span className={`status-pill ${memory.status === 'active' ? 'success' : ''}`}>{memory.status === 'active' ? 'Ativa' : 'Arquivada'}</span></header>
            {memory.status === 'active' ? <form action="/memory/correct" method="post" className="memory-form"><input type="hidden" name="memoryId" value={memory.id} /><label htmlFor={`memory-${memory.id}`}>Conteúdo</label><textarea id={`memory-${memory.id}`} name="content" defaultValue={memory.content} required maxLength={4000} rows={3} /><div><button className="primary-button" type="submit">Salvar correção</button><button className="link-button" formAction="/memory/archive" type="submit">Arquivar</button></div></form> : <p>{memory.content}</p>}
            <details className="technical-details"><summary>Origem e detalhes</summary><p>Escopo: {memory.scope}. Fonte: {memory.source.kind}. Confiança: {Math.round(memory.confidence * 100)}%. Atualizada em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(memory.updatedAt))}.</p></details>
          </article>
        ))}</div>}
      </div>
    </ProductShell>
  )
}
