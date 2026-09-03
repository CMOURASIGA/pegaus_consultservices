const foundations = [
  ['Supabase', 'ready'],
  ['Web e PWA', 'foundation'],
  ['Core', 'next'],
] as const

export default function Home() {
  return (
    <main className="shell">
      <header className="header">
        <div className="brand" aria-label="Pegasus">
          <span className="mark" aria-hidden="true">P</span>
          <div><strong>Pegasus</strong><small>Consult Services</small></div>
        </div>
        <span className="status"><i aria-hidden="true" /> Fundação ativa</span>
      </header>
      <section className="hero">
        <p className="eyebrow">PEGASUS V1</p>
        <h1>Seu assistente operacional privado.</h1>
        <p>Esta é a fundação técnica. Conversa, memória, voz e decisões serão ativadas progressivamente, sempre com contexto, segurança e rastreabilidade.</p>
      </section>
      <section className="grid" aria-label="Estado da fundação">
        {foundations.map(([name, state]) => (
          <article className="card" key={name}>
            <span>{name}</span>
            <strong>{state === 'ready' ? 'Pronto' : state === 'foundation' ? 'Em fundação' : 'Próxima etapa'}</strong>
          </article>
        ))}
      </section>
      <footer>Ambiente de desenvolvimento, nenhuma ação externa é executada nesta tela.</footer>
    </main>
  )
}
