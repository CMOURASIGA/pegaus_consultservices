'use client'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="shell"><section className="hero"><p className="eyebrow">ERRO</p><h1>Não foi possível carregar esta área.</h1><p>Tente novamente. Se o problema continuar, consulte o Control Center.</p><p><button onClick={reset}>Tentar novamente</button></p></section></main>
}
