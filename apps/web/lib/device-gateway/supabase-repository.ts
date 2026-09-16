import 'server-only'

import type {
  AgentCommand, AgentIdentity, DeviceGatewayRepository, GatewayAudit, GatewayReceipt,
  GatewayResult, PairingCompletion, PairingRequest,
} from '@pegasus/core'
import { createAdminClient } from '../supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export class SupabaseDeviceGatewayRepository implements DeviceGatewayRepository {
  constructor(private readonly client: AdminClient = createAdminClient()) {}

  async findIdentity(deviceId: string, keyId: string): Promise<AgentIdentity | null> {
    const identity = await this.client.from('device_agent_identities')
      .select('id,owner_id,device_id,key_id,public_key,algorithm,status,valid_from,valid_until')
      .eq('device_id', deviceId).eq('key_id', keyId).maybeSingle()
    if (identity.error || !identity.data) return null
    const device = await this.client.from('devices').select('status,revoked_at,last_seen_at').eq('id', deviceId).eq('owner_id', identity.data.owner_id).maybeSingle()
    if (device.error || !device.data) return null
    return {
      id: identity.data.id, ownerId: identity.data.owner_id, deviceId: identity.data.device_id,
      keyId: identity.data.key_id, publicKey: identity.data.public_key,
      algorithm: identity.data.algorithm as AgentIdentity['algorithm'], status: identity.data.status as AgentIdentity['status'],
      validFrom: identity.data.valid_from, validUntil: identity.data.valid_until ?? undefined,
      deviceStatus: device.data.status === 'revoked' || device.data.revoked_at
        ? 'revoked'
        : device.data.last_seen_at && Date.parse(device.data.last_seen_at) > Date.now() - 90_000 ? 'online' : 'offline',
      deviceRevokedAt: device.data.revoked_at ?? undefined,
    }
  }

  async registerRequestNonce(input: { deviceId: string; identityId: string; nonceHash: string; requestKind: string; expiresAt: string }) {
    const result = await this.client.from('device_request_nonces').insert({
      device_id: input.deviceId, identity_id: input.identityId, nonce_hash: input.nonceHash,
      request_kind: input.requestKind, expires_at: input.expiresAt,
    })
    if (!result.error) return true
    if (result.error.code === '23505') return false
    throw new Error('NONCE_REGISTRATION_FAILED')
  }

  async createPairingChallenge(input: PairingRequest & { tokenHash: string; expiresAt: string }) {
    const { data, error } = await this.client.from('device_pairing_challenges').insert({
      owner_id: input.ownerId, token_hash: input.tokenHash, status: 'pending',
      requested_trust_level: input.requestedTrust,
      requested_capabilities: {
        capabilities: input.requestedCapabilities, friendlyName: input.friendlyName,
        operatingSystem: input.operatingSystem, agentVersion: input.agentVersion,
      }, expires_at: input.expiresAt,
    }).select('id').single()
    if (error || !data) throw new Error('PAIRING_CREATE_FAILED')
    return data
  }

  async approvePairing(input: { ownerId: string; challengeId: string; capabilities: readonly string[] }) {
    const current = await this.client.from('device_pairing_challenges').select('requested_capabilities,expires_at,status')
      .eq('id', input.challengeId).eq('owner_id', input.ownerId).maybeSingle()
    if (current.error || !current.data || current.data.status !== 'pending' || Date.parse(current.data.expires_at) <= Date.now()) throw new Error('PAIRING_NOT_APPROVABLE')
    const requested = current.data.requested_capabilities as Record<string, unknown>
    const originallyRequested = Array.isArray(requested.capabilities) ? requested.capabilities.filter((v): v is string => typeof v === 'string') : []
    if (input.capabilities.some(capability => !originallyRequested.includes(capability))) throw new Error('CAPABILITY_ESCALATION')
    const { data, error } = await this.client.from('device_pairing_challenges').update({
      status: 'approved', approved_at: new Date().toISOString(), requested_capabilities: { ...requested, capabilities: input.capabilities },
    }).eq('id', input.challengeId).eq('owner_id', input.ownerId).eq('status', 'pending').select('id').maybeSingle()
    if (error || !data) throw new Error('PAIRING_NOT_APPROVABLE')
  }

  async consumePairingChallenge(input: PairingCompletion & { tokenHash: string; publicKey: string }) {
    const { data, error } = await this.client.rpc('complete_device_pairing', {
      p_challenge_id: input.challengeId, p_token_hash: input.tokenHash, p_key_id: input.keyId,
      p_public_key: input.publicKey, p_registration_nonce_hash: input.registrationNonce,
    }).single()
    if (error || !data) throw new Error('PAIRING_NOT_CONSUMABLE')
    const value = data as { ownerId: string; deviceId: string; correlationId: string }
    const grants = await this.client.from('device_capability_grants')
      .select('capability').eq('device_id', value.deviceId).eq('status', 'active')
    if (grants.error) throw new Error('PAIRING_GRANTS_LOOKUP_FAILED')
    return {
      ...value,
      grantedCapabilities: (grants.data ?? []).map(grant => grant.capability),
    }
  }

  async rotateIdentity(input: { ownerId: string; deviceId: string; currentKeyId: string; nextKeyId: string; nextPublicKey: string }) {
    const { error } = await this.client.rpc('rotate_device_agent_identity', {
      p_owner_id: input.ownerId, p_device_id: input.deviceId, p_current_key_id: input.currentKeyId,
      p_next_key_id: input.nextKeyId, p_next_public_key: input.nextPublicKey,
    })
    if (error) throw new Error('IDENTITY_ROTATION_FAILED')
  }

  async recordHeartbeat(input: { identity: AgentIdentity; agentVersion: string; operatingSystem: string; capabilities: readonly string[] }) {
    const { data, error } = await this.client.rpc('record_device_heartbeat', {
      p_identity_id: input.identity.id, p_device_id: input.identity.deviceId,
      p_agent_version: input.agentVersion, p_os_version: input.operatingSystem, p_capabilities: input.capabilities,
    }).single()
    if (error || !data) throw new Error('HEARTBEAT_FAILED')
    return data as { online: boolean; correlationId: string }
  }

  async acquireCommand(input: { identity: AgentIdentity; leaseTokenHash: string; commandNonceHash: string; leaseSeconds: number }) {
    const { data, error } = await this.client.rpc('acquire_device_command_lease', {
      p_device_id: input.identity.deviceId, p_lease_token_hash: input.leaseTokenHash,
      p_command_nonce_hash: input.commandNonceHash, p_lease_seconds: input.leaseSeconds,
    }).maybeSingle()
    if (error) throw new Error('COMMAND_LEASE_FAILED')
    if (!data) return null
    const row = data as Record<string, unknown>
    const attempt = await this.client.from('device_execution_attempts').select('id')
      .eq('command_id', row.id as string).eq('attempt_no', row.attempt_count as number).single()
    if (attempt.error || !attempt.data) throw new Error('EXECUTION_ATTEMPT_MISSING')
    return {
      id: row.id as string, actionId: row.action_id as string, taskId: row.task_id as string,
      attemptId: attempt.data.id, capability: row.capability as string, operation: row.operation as string,
      target: row.target as string, parameters: row.parameters as Record<string, unknown>,
      actionFingerprint: row.action_fingerprint as string, idempotencyKey: row.idempotency_key as string,
      expiresAt: row.expires_at as string, leaseExpiresAt: row.lease_expires_at as string,
      correlationId: row.correlation_id as string, protocolVersion: 1,
    } satisfies Omit<AgentCommand, 'leaseToken' | 'commandNonce'>
  }

  async recordReceipt(input: { identity: AgentIdentity; receipt: GatewayReceipt; leaseTokenHash: string; commandNonceHash: string; nonceHash: string }) {
    const { data, error } = await this.client.rpc('record_device_command_receipt', {
      p_identity_id: input.identity.id, p_device_id: input.identity.deviceId,
      p_command_id: input.receipt.commandId, p_attempt_id: input.receipt.attemptId,
      p_lease_token_hash: input.leaseTokenHash, p_command_nonce_hash: input.commandNonceHash,
      p_receipt_nonce_hash: input.nonceHash,
      p_state: input.receipt.state, p_error_code: input.receipt.errorCode ?? null,
    }).single()
    if (error || !data) throw new Error('RECEIPT_REJECTED')
    return data as { correlationId: string }
  }

  async recordResult(input: { identity: AgentIdentity; result: GatewayResult; leaseTokenHash: string; commandNonceHash: string; nonceHash: string; retry: boolean }) {
    const { data, error } = await this.client.rpc('record_device_command_result', {
      p_identity_id: input.identity.id, p_device_id: input.identity.deviceId,
      p_command_id: input.result.commandId, p_attempt_id: input.result.attemptId,
      p_lease_token_hash: input.leaseTokenHash, p_command_nonce_hash: input.commandNonceHash,
      p_result_nonce_hash: input.nonceHash,
      p_status: input.result.status, p_output: input.result.output, p_error_code: input.result.errorCode ?? null,
      p_agent_version: input.result.agentVersion, p_evidence_digest: input.result.evidenceDigest ?? null,
      p_correlation_id: input.result.correlationId, p_retry: input.retry,
    }).single()
    if (error || !data) throw new Error('RESULT_REJECTED')
    return data as { correlationId: string; taskId: string; terminal: boolean; successful: boolean }
  }

  async revokeDevice(input: { ownerId: string; deviceId: string; reason: string }) {
    const { error } = await this.client.rpc('revoke_device_runtime', {
      p_owner_id: input.ownerId, p_device_id: input.deviceId, p_reason: input.reason,
    })
    if (error) throw new Error('DEVICE_REVOCATION_FAILED')
  }

  async audit(event: GatewayAudit) {
    const { error } = await this.client.from('audit_events').insert({
      owner_id: event.ownerId ?? null, actor_type: event.deviceId ? 'device_agent' : 'system',
      action: event.action, target_type: event.deviceId ? 'device' : 'device_gateway',
      target_ref: event.deviceId ?? null, outcome: event.outcome,
      risk_level: event.outcome === 'denied' || event.outcome === 'revoked' ? 'attention' : 'info',
      correlation_id: event.correlationId ?? null, metadata: event.metadata ?? {},
    })
    if (error) throw new Error('GATEWAY_AUDIT_FAILED')
  }
}
