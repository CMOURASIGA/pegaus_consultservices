import { redirect } from 'next/navigation'
import { createClient } from '../lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims as { sub?: string } | undefined

  redirect(!error && claims?.sub ? '/app' : '/login')
}
