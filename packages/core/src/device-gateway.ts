import { canonicalJson } from './authorization-pipeline'

export type AgentIdentity = {
  id: string
  ownerId: string
  deviceId: string
  keyId: string
  publicKey: string
  algorithm: 'ECDSA_P256_SHA256'
  status: 'active' | 'rotated' | 'revoked'
  validFrom: string
  validUntil?: string
  deviceStatus: 'offline' | 'online' | 'revoked'
  deviceRevokedAt?: string
}

export type AgentRequestProof = {
  deviceId: string
  keyId: string
  timestamp: string
  nonce: string
  bodyDigest: string
  signature: string
}

export type AgentCommand = {
  id: string
  actionId: string
  taskId: string
  attemptId: string
  capability: string
  operation: string
  target: string
  parameters: Readonly<Record<string, unknown>>
  actionFingerprint: string
  idempotencyKey: string
  commandNonce: string
  expiresAt: string
  leaseToken: string
  leaseExpiresAt: string
  correlationId: string
  protocolVersion: 1
}

export type PairingRequest = {
  ownerId: string
  friendlyName: string
  operatingSystem: string
  agentVersion: string
  requestedCapabilities: readonly string[]
  requestedTrust: 'temporary' | 'trusted'
}

export type PairingChallenge = { id: string; token: string; expiresAt: string }

export type PairingCompletionResult = {
  ownerId: string
  deviceId: string
  correlationId: string
  grantedCapabilities: readonly string[]
}

export type PairingCompletion = {
  challengeId: string
  token: string
  keyId: string
  publicKey: string
  registrationNonce: string
  registrationSignature: string
}

export type GatewayReceipt = {
  commandId: string
  attemptId: string
  leaseToken: string
  commandNonce: string
  state: 'accepted' | 'rejected'
  errorCode?: string
}

export type GatewayResult = {
  commandId: string
  attemptId: string
  leaseToken: string
  commandNonce: string
  status: 'completed' | 'failed'
  output: Readonly<Record<string, unknown>>
  errorCode?: string
  agentVersion: string
  evidenceDigest?: string
  correlationId: string
}

export type GatewayAudit = {
  ownerId?: string
  deviceId?: string
  correlationId?: string
  action: string
  outcome: 'success' | 'denied' | 'failed' | 'revoked'
  metadata?: Readonly<Record<string, string | number | boolean | null>>
}

export interface DeviceGatewayRepository {
  findIdentity(deviceId: string, keyId: string): Promise<AgentIdentity | null>
  registerRequestNonce(input: { deviceId: string; identityId: string; nonceHash: string; requestKind: string; expiresAt: string }): Promise<boolean>
  createPairingChallenge(input: PairingRequest & { tokenHash: string; expiresAt: string }): Promise<{ id: string }>
  consumePairingChallenge(input: PairingCompletion & { tokenHash: string; publicKey: string }): Promise<PairingCompletionResult>
  rotateIdentity(input: { ownerId: string; deviceId: string; currentKeyId: string; nextKeyId: string; nextPublicKey: string; now: string }): Promise<void>
  recordHeartbeat(input: { identity: AgentIdentity; agentVersion: string; operatingSystem: string; capabilities: readonly string[]; seenAt: string; offlineAfter: string }): Promise<{ online: boolean; correlationId: string }>
  acquireCommand(input: { identity: AgentIdentity; leaseTokenHash: string; commandNonceHash: string; leaseSeconds: number; now: string }): Promise<Omit<AgentCommand, 'leaseToken' | 'commandNonce'> | null>
  recordReceipt(input: { identity: AgentIdentity; receipt: GatewayReceipt; leaseTokenHash: string; commandNonceHash: string; nonceHash: string; now: string }): Promise<{ correlationId: string }>
  recordResult(input: { identity: AgentIdentity; result: GatewayResult; leaseTokenHash: string; commandNonceHash: string; nonceHash: string; retry: boolean; now: string }): Promise<{ correlationId: string; taskId: string; terminal: boolean; successful: boolean }>
  revokeDevice(input: { ownerId: string; deviceId: string; reason: string; now: string }): Promise<void>
  audit(event: GatewayAudit): Promise<void>
}

export interface AgentSignatureVerifier {
  verify(input: { publicKey: string; signature: string; message: string }): Promise<boolean>
  validatePublicKey(publicKey: string): Promise<boolean>
}

export type GatewayClock = { now(): Date }
export type GatewayRandom = { token(bytes: number): string }

export class DeviceGatewayError extends Error {
  constructor(
    readonly code:
      | 'AUTH_INVALID' | 'IDENTITY_REVOKED' | 'DEVICE_REVOKED' | 'SIGNATURE_INVALID'
      | 'REQUEST_EXPIRED' | 'REPLAY_DETECTED' | 'BODY_DIGEST_INVALID'
      | 'PAIRING_EXPIRED' | 'PAIRING_INVALID' | 'PUBLIC_KEY_INVALID'
      | 'COMMAND_EXPIRED' | 'LEASE_INVALID' | 'RECEIPT_INVALID' | 'RESULT_INVALID',
    readonly status: number,
  ) {
    super(code)
    this.name = 'DeviceGatewayError'
  }
}

const TRANSIENT_ERRORS = new Set(['network_unavailable', 'gateway_timeout', 'device_busy', 'temporary_io_error'])

export class DeviceGateway {
  constructor(
    private readonly repository: DeviceGatewayRepository,
    private readonly verifier: AgentSignatureVerifier,
    private readonly clock: GatewayClock = { now: () => new Date() },
    private readonly random: GatewayRandom = { token: bytes => randomToken(bytes) },
    private readonly maxClockSkewMs = 120_000,
  ) {}

  async createPairing(input: PairingRequest, ttlMs = 300_000): Promise<PairingChallenge> {
    if (!input.ownerId || !input.friendlyName.trim() || input.requestedCapabilities.length === 0) {
      throw new DeviceGatewayError('PAIRING_INVALID', 400)
    }
    const token = this.random.token(32)
    const expiresAt = new Date(this.clock.now().getTime() + ttlMs).toISOString()
    const record = await this.repository.createPairingChallenge({ ...input, tokenHash: await sha256(token), expiresAt })
    await this.repository.audit({ ownerId: input.ownerId, action: 'device.pairing.requested', outcome: 'success' })
    return { id: record.id, token, expiresAt }
  }

  async completePairing(input: PairingCompletion) {
    if (!(await this.verifier.validatePublicKey(input.publicKey))) throw new DeviceGatewayError('PUBLIC_KEY_INVALID', 400)
    const tokenHash = await sha256(input.token)
    const possessionProof = canonicalPairingProof(input.challengeId, tokenHash, input.registrationNonce)
    if (!(await this.verifier.verify({ publicKey: input.publicKey, signature: input.registrationSignature, message: possessionProof }))) {
      throw new DeviceGatewayError('SIGNATURE_INVALID', 401)
    }
    try {
      const result = await this.repository.consumePairingChallenge({
        ...input, tokenHash, registrationNonce: await sha256(input.registrationNonce),
      })
      await this.repository.audit({ ownerId: result.ownerId, deviceId: result.deviceId, correlationId: result.correlationId, action: 'device.pairing.consumed', outcome: 'success' })
      return result
    } catch {
      throw new DeviceGatewayError('PAIRING_EXPIRED', 403)
    }
  }

  async authenticate(input: { proof: AgentRequestProof; method: string; path: string; body: unknown; requestKind: string }): Promise<AgentIdentity> {
    const now = this.clock.now()
    const timestamp = Date.parse(input.proof.timestamp)
    if (!Number.isFinite(timestamp) || Math.abs(now.getTime() - timestamp) > this.maxClockSkewMs) {
      throw new DeviceGatewayError('REQUEST_EXPIRED', 401)
    }
    const identity = await this.repository.findIdentity(input.proof.deviceId, input.proof.keyId)
    if (!identity) throw new DeviceGatewayError('AUTH_INVALID', 401)
    if (identity.status !== 'active' || (identity.validUntil && Date.parse(identity.validUntil) <= now.getTime())) {
      throw new DeviceGatewayError('IDENTITY_REVOKED', 403)
    }
    if (identity.deviceStatus === 'revoked' || identity.deviceRevokedAt) throw new DeviceGatewayError('DEVICE_REVOKED', 403)
    const bodyDigest = await sha256(canonicalJson(input.body))
    if (!constantTimeEqual(bodyDigest, input.proof.bodyDigest)) throw new DeviceGatewayError('BODY_DIGEST_INVALID', 401)
    const message = canonicalAgentRequest(input.method, input.path, input.proof.timestamp, input.proof.nonce, bodyDigest)
    if (!(await this.verifier.verify({ publicKey: identity.publicKey, signature: input.proof.signature, message }))) {
      await this.repository.audit({ ownerId: identity.ownerId, deviceId: identity.deviceId, action: 'device.request.signature', outcome: 'denied' })
      throw new DeviceGatewayError('SIGNATURE_INVALID', 401)
    }
    const accepted = await this.repository.registerRequestNonce({
      deviceId: identity.deviceId, identityId: identity.id, nonceHash: await sha256(input.proof.nonce),
      requestKind: input.requestKind, expiresAt: new Date(now.getTime() + this.maxClockSkewMs * 2).toISOString(),
    })
    if (!accepted) throw new DeviceGatewayError('REPLAY_DETECTED', 409)
    return identity
  }

  async heartbeat(input: { identity: AgentIdentity; agentVersion: string; operatingSystem: string; capabilities: readonly string[] }) {
    const now = this.clock.now()
    const result = await this.repository.recordHeartbeat({
      ...input, seenAt: now.toISOString(), offlineAfter: new Date(now.getTime() - 90_000).toISOString(),
    })
    await this.repository.audit({ ownerId: input.identity.ownerId, deviceId: input.identity.deviceId, correlationId: result.correlationId, action: 'device.heartbeat', outcome: 'success' })
    return { status: result.online ? 'online' as const : 'offline' as const, nextPollAfterMs: 20_000 }
  }

  async poll(input: { identity: AgentIdentity; leaseSeconds?: number }) {
    const leaseToken = this.random.token(32)
    const commandNonce = this.random.token(32)
    const command = await this.repository.acquireCommand({
      identity: input.identity, leaseTokenHash: await sha256(leaseToken), commandNonceHash: await sha256(commandNonce), leaseSeconds: input.leaseSeconds ?? 30,
      now: this.clock.now().toISOString(),
    })
    if (!command) return { command: null, nextPollAfterMs: 20_000 }
    if (Date.parse(command.expiresAt) <= this.clock.now().getTime()) throw new DeviceGatewayError('COMMAND_EXPIRED', 409)
    await this.repository.audit({ ownerId: input.identity.ownerId, deviceId: input.identity.deviceId, correlationId: command.correlationId, action: 'device.command.leased', outcome: 'success' })
    return { command: { ...command, leaseToken, commandNonce }, nextPollAfterMs: 5_000 }
  }

  async receipt(input: { identity: AgentIdentity; receipt: GatewayReceipt; requestNonce: string }) {
    if (!input.receipt.commandId || !input.receipt.attemptId || !input.receipt.leaseToken || !input.receipt.commandNonce) throw new DeviceGatewayError('RECEIPT_INVALID', 400)
    const result = await this.repository.recordReceipt({
      identity: input.identity, receipt: input.receipt, leaseTokenHash: await sha256(input.receipt.leaseToken),
      commandNonceHash: await sha256(input.receipt.commandNonce), nonceHash: await sha256(input.requestNonce), now: this.clock.now().toISOString(),
    })
    await this.repository.audit({ ownerId: input.identity.ownerId, deviceId: input.identity.deviceId, correlationId: result.correlationId, action: 'device.command.receipt', outcome: input.receipt.state === 'accepted' ? 'success' : 'denied' })
    return result
  }

  async result(input: { identity: AgentIdentity; result: GatewayResult; requestNonce: string }) {
    if (input.result.status === 'completed' && input.result.errorCode) throw new DeviceGatewayError('RESULT_INVALID', 400)
    if (canonicalJson(input.result.output).length > 256_000) throw new DeviceGatewayError('RESULT_INVALID', 413)
    const retry = input.result.status === 'failed' && Boolean(input.result.errorCode && TRANSIENT_ERRORS.has(input.result.errorCode))
    const recorded = await this.repository.recordResult({
      identity: input.identity, result: input.result, leaseTokenHash: await sha256(input.result.leaseToken),
      commandNonceHash: await sha256(input.result.commandNonce), nonceHash: await sha256(input.requestNonce), retry, now: this.clock.now().toISOString(),
    })
    await this.repository.audit({ ownerId: input.identity.ownerId, deviceId: input.identity.deviceId, correlationId: recorded.correlationId, action: retry ? 'device.command.retry_scheduled' : 'device.command.result', outcome: recorded.successful ? 'success' : 'failed' })
    return { ...recorded, retryScheduled: retry && !recorded.terminal }
  }

  async rotateIdentity(input: { ownerId: string; deviceId: string; currentKeyId: string; nextKeyId: string; nextPublicKey: string; nextKeySignature: string }) {
    if (!(await this.verifier.validatePublicKey(input.nextPublicKey))) throw new DeviceGatewayError('PUBLIC_KEY_INVALID', 400)
    const proof = canonicalRotationProof(input.deviceId, input.currentKeyId, input.nextKeyId, input.nextPublicKey)
    if (!(await this.verifier.verify({ publicKey: input.nextPublicKey, signature: input.nextKeySignature, message: proof }))) {
      throw new DeviceGatewayError('SIGNATURE_INVALID', 401)
    }
    await this.repository.rotateIdentity({ ...input, now: this.clock.now().toISOString() })
    await this.repository.audit({ ownerId: input.ownerId, deviceId: input.deviceId, action: 'device.identity.rotated', outcome: 'success' })
  }

  async revoke(input: { ownerId: string; deviceId: string; reason: string }) {
    await this.repository.revokeDevice({ ...input, now: this.clock.now().toISOString() })
    await this.repository.audit({ ownerId: input.ownerId, deviceId: input.deviceId, action: 'device.revoked', outcome: 'revoked' })
  }
}

export class WebCryptoAgentSignatureVerifier implements AgentSignatureVerifier {
  async validatePublicKey(publicKey: string) {
    try { await importEcdsaPublicKey(publicKey); return true } catch { return false }
  }
  async verify(input: { publicKey: string; signature: string; message: string }) {
    try {
      const key = await importEcdsaPublicKey(input.publicKey)
      return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, fromBase64Url(input.signature), new TextEncoder().encode(input.message))
    } catch { return false }
  }
}

export function canonicalAgentRequest(method: string, path: string, timestamp: string, nonce: string, bodyDigest: string) {
  return `${method.toUpperCase()}\n${path}\n${timestamp}\n${nonce}\n${bodyDigest}`
}

export function canonicalPairingProof(challengeId: string, tokenHash: string, registrationNonce: string) {
  return ['PEGASUS-PAIRING-V1', challengeId, tokenHash, registrationNonce].join('\n')
}

export function canonicalRotationProof(deviceId: string, currentKeyId: string, nextKeyId: string, nextPublicKey: string) {
  return ['PEGASUS-ROTATION-V1', deviceId, currentKeyId, nextKeyId, nextPublicKey].join('\n')
}

export async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return toBase64Url(new Uint8Array(bytes))
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let i = 0; i < left.length; i += 1) difference |= left.charCodeAt(i) ^ right.charCodeAt(i)
  return difference === 0
}

function randomToken(bytes: number) {
  const value = new Uint8Array(bytes)
  crypto.getRandomValues(value)
  return toBase64Url(value)
}

function toBase64Url(value: Uint8Array) {
  return Buffer.from(value).toString('base64url')
}

function fromBase64Url(value: string) {
  return new Uint8Array(Buffer.from(value, 'base64url'))
}

async function importEcdsaPublicKey(publicKey: string) {
  const normalized = publicKey.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, '')
  const der = new Uint8Array(Buffer.from(normalized, 'base64'))
  return crypto.subtle.importKey('spki', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
}
