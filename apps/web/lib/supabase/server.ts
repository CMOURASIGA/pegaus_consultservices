import 'server-only'

import { readPublicConfig } from '@pegasus/config'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const config = readPublicConfig()
  if (!config.NEXT_PUBLIC_SUPABASE_URL || !config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Supabase public configuration is unavailable')
  }
  const store = await cookies()
  return createServerClient(config.NEXT_PUBLIC_SUPABASE_URL, config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options))
        } catch {
          // Server Components cannot write cookies. proxy.ts performs refresh writes.
        }
      },
    },
  })
}
