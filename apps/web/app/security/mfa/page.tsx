import { getVerifiedIdentity } from '../../../lib/auth/server'
import { MfaManager } from './mfa-manager'

export const dynamic = 'force-dynamic'

export default async function MfaPage() {
  const { claims } = await getVerifiedIdentity()
  return <MfaManager initialAal={claims.aal === 'aal2' ? 'aal2' : 'aal1'} />
}
