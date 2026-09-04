import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pegasus', short_name: 'Pegasus', description: 'Assistente pessoal e profissional privado',
    id: '/app', start_url: '/app', scope: '/', display: 'standalone', background_color: '#ffffff', theme_color: '#0b4ea2',
    orientation: 'any', categories: ['productivity', 'utilities'], lang: 'pt-BR',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  }
}
