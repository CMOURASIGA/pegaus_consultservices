'use client'

import { readPublicConfig } from '@pegasus/config'
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const config = readPublicConfig()
  if (!config.NEXT_PUBLIC_SUPABASE_URL || !config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Supabase public configuration is unavailable')
  }
  return createBrowserClient(config.NEXT_PUBLIC_SUPABASE_URL, config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
}
