import 'server-only'

import { readPublicConfig, readServerConfig } from '@pegasus/config'
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const publicConfig = readPublicConfig()
  const serverConfig = readServerConfig()
  if (!publicConfig.NEXT_PUBLIC_SUPABASE_URL || !serverConfig.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase privileged server configuration is unavailable')
  }
  return createClient(publicConfig.NEXT_PUBLIC_SUPABASE_URL, serverConfig.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}
