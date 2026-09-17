import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { ServiceWorkerRegistration } from './service-worker-registration'
import './styles.css'

export const metadata: Metadata = {
  title: 'Pegasus',
  description: 'Assistente pessoal e profissional privado',
  applicationName: 'Pegasus',
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f7fc' },
    { media: '(prefers-color-scheme: dark)', color: '#050a16' },
  ],
  colorScheme: 'light dark',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}
