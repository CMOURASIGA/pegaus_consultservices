'use client'

export default function AppError({ reset }: { reset: () => void }) {
  return <main className="personal-home"><section className="home-error"><p className="eyebrow">INÍCIO INDISPONÍVEL</p><h1>Não foi possível carregar seu contexto agora.</h1><p>Suas informações não foram alteradas. Tente novamente.</p><button className="primary-button" type="button" onClick={reset}>Tentar novamente</button></section></main>
}
