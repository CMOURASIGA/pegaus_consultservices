import { getVerifiedIdentity } from '../../lib/auth/server'
import { SupabaseKnowledgeRepository } from '../../lib/knowledge/store'
import { ProductShell } from '../product-shell'

export const dynamic = 'force-dynamic'

const statusLabel: Record<string, string> = { pending: 'Aguardando', indexing: 'Indexando', ready: 'Disponível', failed: 'Falha na indexação' }

export default async function KnowledgePage() {
  const { claims, supabase } = await getVerifiedIdentity()
  const repository = new SupabaseKnowledgeRepository(supabase)
  const [documents, drive] = await Promise.all([repository.list(claims.sub!), repository.driveStatus(claims.sub!)])
  return (
    <ProductShell area="knowledge" eyebrow="CONHECIMENTO DOCUMENTAL" title="Documentos">
      <div className="settings-page">
        <div className="settings-heading"><p className="eyebrow">KNOWLEDGE STORE</p><h1>Fontes autorizadas</h1><p className="muted">O Pegasus consulta apenas documentos que você autorizou. Conteúdo externo nunca concede permissão para executar ações.</p></div>
        <section className="settings-card">
          <strong>{drive?.status === 'active' ? 'Google Drive conectado para leitura' : 'Google Drive ainda não conectado'}</strong>
          <p className="muted">{drive?.status === 'active' ? 'Somente fontes explicitamente autorizadas podem ser consultadas e indexadas.' : 'A conexão será somente para leitura e exigirá sua autorização pelo Google. Nenhum token será exibido ou armazenado no navegador.'}</p>
        </section>
        {documents.length ? <div className="memory-list">{documents.map((document) => <article className="memory-card" key={document.id}><header><div><span>{document.provider === 'google_drive' ? 'GOOGLE DRIVE' : 'DOCUMENTO'}</span><strong>{document.title}</strong></div><span className={`status-pill ${document.indexing_status === 'ready' ? 'success' : ''}`}>{statusLabel[document.indexing_status] ?? document.indexing_status}</span></header><p className="muted">{document.mime_type ?? 'Formato não informado'} · Atualizado em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(document.updated_at))}</p></article>)}</div> : <section className="settings-card"><strong>Nenhum documento indexado</strong><p className="muted">Quando uma fonte autorizada for conectada, os documentos disponíveis aparecerão aqui com sua origem e situação.</p></section>}
      </div>
    </ProductShell>
  )
}
