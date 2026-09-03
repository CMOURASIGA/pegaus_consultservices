'use client'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="pt-BR"><body><main><h1>Pegasus está temporariamente indisponível.</h1><button onClick={reset}>Tentar novamente</button></main></body></html>
}
