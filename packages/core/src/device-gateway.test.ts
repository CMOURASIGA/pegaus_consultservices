import { describe, expect, it } from 'vitest'
import {
  DeviceGateway, WebCryptoAgentSignatureVerifier, canonicalAgentRequest,
  sha256, type AgentCommand, type AgentIdentity, type AgentSignatureVerifier,
  type DeviceGatewayRepository, type GatewayAudit, type GatewayReceipt, type GatewayResult,
} from './device-gateway'
import { canonicalJson } from './authorization-pipeline'

const NOW = new Date('2026-09-15T12:00:00.000Z')
const identity: AgentIdentity = {
  id: 'identity-1', ownerId: 'owner-1', deviceId: 'device-1', keyId: 'key-1', publicKey: 'valid-key',
  algorithm: 'ECDSA_P256_SHA256', status: 'active', validFrom: '2026-09-14T00:00:00.000Z', deviceStatus: 'online',
}
const baseCommand: Omit<AgentCommand, 'leaseToken' | 'commandNonce'> = {
  id: 'command-1', actionId: 'action-1', taskId: 'task-1', attemptId: 'attempt-1',
  capability: 'filesystem.list', operation: 'filesystem.list', target: 'documents', parameters: { relativePath: '.' },
  actionFingerprint: 'fingerprint', idempotencyKey: 'idem-1', expiresAt: '2026-09-15T12:05:00.000Z',
  leaseExpiresAt: '2026-09-15T12:00:30.000Z', correlationId: 'correlation-1', protocolVersion: 1,
}

class FakeVerifier implements AgentSignatureVerifier {
  verifyResult = true
  async verify() { return this.verifyResult }
  async validatePublicKey(key: string) { return key === 'valid-key' }
}

class FakeRepository implements DeviceGatewayRepository {
  identity: AgentIdentity | null = { ...identity }
  nonces = new Set<string>()
  pairingConsumed = false
  command: Omit<AgentCommand, 'leaseToken' | 'commandNonce'> | null = { ...baseCommand }
  audits: GatewayAudit[] = []
  receipts: GatewayReceipt[] = []
  results: GatewayResult[] = []
  retries: boolean[] = []
  revoked = false
  heartbeats = 0
  async findIdentity(deviceId: string, keyId: string) { return this.identity?.deviceId === deviceId && this.identity.keyId === keyId ? this.identity : null }
  async registerRequestNonce(input: { nonceHash: string }) { if (this.nonces.has(input.nonceHash)) return false; this.nonces.add(input.nonceHash); return true }
  async createPairingChallenge() { return { id: 'challenge-1' } }
  async consumePairingChallenge() {
    if (this.pairingConsumed) throw new Error('consumed')
    this.pairingConsumed = true
    return { ownerId: 'owner-1', deviceId: 'device-1', correlationId: 'correlation-1' }
  }
  async rotateIdentity() { if (this.identity) this.identity = { ...this.identity, keyId: 'key-2', publicKey: 'valid-key' } }
  async recordHeartbeat() { this.heartbeats += 1; return { online: true, correlationId: 'correlation-1' } }
  async acquireCommand() { const result = this.command; this.command = null; return result }
  async recordReceipt(input: { receipt: GatewayReceipt }) { this.receipts.push(input.receipt); return { correlationId: 'correlation-1' } }
  async recordResult(input: { result: GatewayResult; retry: boolean }) {
    this.results.push(input.result); this.retries.push(input.retry)
    return { correlationId: 'correlation-1', taskId: 'task-1', terminal: !input.retry, successful: input.result.status === 'completed' }
  }
  async revokeDevice() { this.revoked = true; if (this.identity) this.identity = { ...this.identity, status: 'revoked', deviceStatus: 'revoked' } }
  async audit(event: GatewayAudit) { this.audits.push(event) }
}

const clock = { now: () => new Date(NOW) }
const random = { token: (bytes: number) => `random-${bytes}` }
const body = { agentVersion: '1.0.0' }

async function proof(overrides: Partial<{ deviceId: string; keyId: string; timestamp: string; nonce: string; bodyDigest: string; signature: string }> = {}) {
  return {
    deviceId: 'device-1', keyId: 'key-1', timestamp: NOW.toISOString(), nonce: 'nonce-1',
    bodyDigest: await sha256(canonicalJson(body)), signature: 'signature', ...overrides,
  }
}

describe('Device Gateway authentication', () => {
  it('accepts a valid signed Agent and registers the nonce', async () => {
    const repo = new FakeRepository()
    const result = await new DeviceGateway(repo, new FakeVerifier(), clock, random).authenticate({ proof: await proof(), method: 'POST', path: '/api/device/heartbeat', body, requestKind: 'heartbeat' })
    expect(result.id).toBe('identity-1')
    expect(repo.nonces.size).toBe(1)
  })
  it('rejects unknown Agent, revoked identity and revoked device', async () => {
    const repo = new FakeRepository(); const gateway = new DeviceGateway(repo, new FakeVerifier(), clock, random)
    repo.identity = null
    await expect(gateway.authenticate({ proof: await proof(), method: 'POST', path: '/x', body, requestKind: 'x' })).rejects.toMatchObject({ code: 'AUTH_INVALID' })
    repo.identity = { ...identity, status: 'revoked' }
    await expect(gateway.authenticate({ proof: await proof(), method: 'POST', path: '/x', body, requestKind: 'x' })).rejects.toMatchObject({ code: 'IDENTITY_REVOKED' })
    repo.identity = { ...identity, deviceStatus: 'revoked' }
    await expect(gateway.authenticate({ proof: await proof(), method: 'POST', path: '/x', body, requestKind: 'x' })).rejects.toMatchObject({ code: 'DEVICE_REVOKED' })
  })
  it('rejects invalid signature, stale timestamp and body mismatch', async () => {
    const repo = new FakeRepository(); const verifier = new FakeVerifier(); const gateway = new DeviceGateway(repo, verifier, clock, random)
    verifier.verifyResult = false
    await expect(gateway.authenticate({ proof: await proof(), method: 'POST', path: '/x', body, requestKind: 'x' })).rejects.toMatchObject({ code: 'SIGNATURE_INVALID' })
    verifier.verifyResult = true
    await expect(gateway.authenticate({ proof: await proof({ timestamp: '2026-09-15T11:00:00.000Z' }), method: 'POST', path: '/x', body, requestKind: 'x' })).rejects.toMatchObject({ code: 'REQUEST_EXPIRED' })
    await expect(gateway.authenticate({ proof: await proof({ bodyDigest: 'wrong' }), method: 'POST', path: '/x', body, requestKind: 'x' })).rejects.toMatchObject({ code: 'BODY_DIGEST_INVALID' })
  })
  it('rejects nonce reuse and replay', async () => {
    const repo = new FakeRepository(); const gateway = new DeviceGateway(repo, new FakeVerifier(), clock, random)
    const input = { proof: await proof(), method: 'POST', path: '/x', body, requestKind: 'x' }
    await gateway.authenticate(input)
    await expect(gateway.authenticate(input)).rejects.toMatchObject({ code: 'REPLAY_DETECTED' })
  })
})

describe('Pairing, heartbeat and revocation', () => {
  it('creates a short-lived hashed single-use pairing challenge', async () => {
    const repo = new FakeRepository(); const gateway = new DeviceGateway(repo, new FakeVerifier(), clock, random)
    const challenge = await gateway.createPairing({ ownerId: 'owner-1', friendlyName: 'PC', operatingSystem: 'Windows', agentVersion: '1', requestedCapabilities: ['filesystem.list'], requestedTrust: 'trusted' })
    expect(challenge).toEqual({ id: 'challenge-1', token: 'random-32', expiresAt: '2026-09-15T12:05:00.000Z' })
  })
  it('rejects invalid public key and reused pairing', async () => {
    const repo = new FakeRepository(); const gateway = new DeviceGateway(repo, new FakeVerifier(), clock, random)
    await expect(gateway.completePairing({ challengeId: 'c', token: 't', keyId: 'k', publicKey: 'bad', registrationNonce: 'n', registrationSignature: 'bad' })).rejects.toMatchObject({ code: 'PUBLIC_KEY_INVALID' })
    const input = { challengeId: 'c', token: 't', keyId: 'k', publicKey: 'valid-key', registrationNonce: 'n', registrationSignature: 'signature' }
    await gateway.completePairing(input)
    await expect(gateway.completePairing(input)).rejects.toMatchObject({ code: 'PAIRING_EXPIRED' })
  })
  it('requires proof of possession for pairing and identity rotation', async () => {
    const repo = new FakeRepository(); const verifier = new FakeVerifier(); const gateway = new DeviceGateway(repo, verifier, clock, random)
    verifier.verifyResult = false
    await expect(gateway.completePairing({ challengeId: 'c', token: 't', keyId: 'key-next', publicKey: 'valid-key', registrationNonce: 'n', registrationSignature: 'bad' })).rejects.toMatchObject({ code: 'SIGNATURE_INVALID' })
    await expect(gateway.rotateIdentity({ ownerId: 'owner-1', deviceId: 'device-1', currentKeyId: 'key-1', nextKeyId: 'key-next', nextPublicKey: 'valid-key', nextKeySignature: 'bad' })).rejects.toMatchObject({ code: 'SIGNATURE_INVALID' })
    verifier.verifyResult = true
    await gateway.rotateIdentity({ ownerId: 'owner-1', deviceId: 'device-1', currentKeyId: 'key-1', nextKeyId: 'key-next', nextPublicKey: 'valid-key', nextKeySignature: 'valid' })
    expect(repo.identity?.keyId).toBe('key-2')
  })
  it('derives online state only after authenticated heartbeat', async () => {
    const repo = new FakeRepository(); const gateway = new DeviceGateway(repo, new FakeVerifier(), clock, random)
    expect(await gateway.heartbeat({ identity, agentVersion: '1', operatingSystem: 'Windows', capabilities: ['filesystem.list'] })).toMatchObject({ status: 'online' })
    expect(repo.heartbeats).toBe(1)
  })
  it('revokes the device and blocks its next request', async () => {
    const repo = new FakeRepository(); const gateway = new DeviceGateway(repo, new FakeVerifier(), clock, random)
    await gateway.revoke({ ownerId: 'owner-1', deviceId: 'device-1', reason: 'owner_request' })
    expect(repo.revoked).toBe(true)
    await expect(gateway.authenticate({ proof: await proof(), method: 'POST', path: '/x', body, requestKind: 'x' })).rejects.toMatchObject({ code: 'IDENTITY_REVOKED' })
  })
})

describe('Lease, receipt, result and retry', () => {
  it('leases one command once across competing polls', async () => {
    const repo = new FakeRepository(); const gateway = new DeviceGateway(repo, new FakeVerifier(), clock, random)
    const [left, right] = await Promise.all([gateway.poll({ identity }), gateway.poll({ identity })])
    expect([left.command, right.command].filter(Boolean)).toHaveLength(1)
  })
  it('rejects an expired command', async () => {
    const repo = new FakeRepository(); repo.command = { ...baseCommand, expiresAt: '2026-09-15T11:59:59.000Z' }
    await expect(new DeviceGateway(repo, new FakeVerifier(), clock, random).poll({ identity })).rejects.toMatchObject({ code: 'COMMAND_EXPIRED' })
  })
  it('records authenticated receipt and structured successful result', async () => {
    const repo = new FakeRepository(); const gateway = new DeviceGateway(repo, new FakeVerifier(), clock, random)
    const receipt: GatewayReceipt = { commandId: 'command-1', attemptId: 'attempt-1', leaseToken: 'lease', commandNonce: 'command-nonce', state: 'accepted' }
    await gateway.receipt({ identity, receipt, requestNonce: 'receipt-nonce' })
    const result: GatewayResult = { commandId: 'command-1', attemptId: 'attempt-1', leaseToken: 'lease', commandNonce: 'command-nonce', status: 'completed', output: { entries: [] }, agentVersion: '1', correlationId: 'correlation-1' }
    expect(await gateway.result({ identity, result, requestNonce: 'result-nonce' })).toMatchObject({ terminal: true, successful: true, retryScheduled: false })
    expect(repo.receipts).toHaveLength(1); expect(repo.results).toHaveLength(1)
  })
  it('retries only allowlisted transient failure', async () => {
    const repo = new FakeRepository(); const gateway = new DeviceGateway(repo, new FakeVerifier(), clock, random)
    const make = (errorCode: string): GatewayResult => ({ commandId: 'c', attemptId: 'a', leaseToken: 'l', commandNonce: 'cn', status: 'failed', output: {}, errorCode, agentVersion: '1', correlationId: 'correlation-1' })
    expect((await gateway.result({ identity, result: make('gateway_timeout'), requestNonce: 'n1' })).retryScheduled).toBe(true)
    expect((await gateway.result({ identity, result: make('permission_denied'), requestNonce: 'n2' })).retryScheduled).toBe(false)
    expect(repo.retries).toEqual([true, false])
  })
  it('rejects malformed receipt and result', async () => {
    const repo = new FakeRepository(); const gateway = new DeviceGateway(repo, new FakeVerifier(), clock, random)
    await expect(gateway.receipt({ identity, receipt: { commandId: '', attemptId: 'a', leaseToken: 'l', commandNonce: 'cn', state: 'accepted' }, requestNonce: 'n' })).rejects.toMatchObject({ code: 'RECEIPT_INVALID' })
    await expect(gateway.result({ identity, result: { commandId: 'c', attemptId: 'a', leaseToken: 'l', commandNonce: 'cn', status: 'completed', output: {}, errorCode: 'bad', agentVersion: '1', correlationId: 'x' }, requestNonce: 'n' })).rejects.toMatchObject({ code: 'RESULT_INVALID' })
  })
  it('carries the correlation ID through lease and audit', async () => {
    const repo = new FakeRepository(); const gateway = new DeviceGateway(repo, new FakeVerifier(), clock, random)
    await gateway.poll({ identity })
    expect(repo.audits.at(-1)).toMatchObject({ correlationId: 'correlation-1', action: 'device.command.leased' })
  })
})

describe('real ECDSA verifier', () => {
  it('verifies a P-256 signature over the canonical request', async () => {
    const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const publicDer = new Uint8Array(await crypto.subtle.exportKey('spki', keys.publicKey))
    const pem = `-----BEGIN PUBLIC KEY-----\n${Buffer.from(publicDer).toString('base64')}\n-----END PUBLIC KEY-----`
    const message = canonicalAgentRequest('POST', '/api/device/heartbeat', NOW.toISOString(), 'nonce', await sha256('{}'))
    const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.privateKey, new TextEncoder().encode(message)))
    expect(await new WebCryptoAgentSignatureVerifier().verify({ publicKey: pem, signature: Buffer.from(signature).toString('base64url'), message })).toBe(true)
  })
})
