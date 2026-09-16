import { describe, expect, it } from 'vitest'
import {
  DeviceGateway, WebCryptoAgentSignatureVerifier, canonicalAgentRequest, canonicalPairingProof,
  sha256, type AgentCommand, type AgentIdentity, type DeviceGatewayRepository,
  type GatewayAudit, type GatewayReceipt, type GatewayResult,
} from './device-gateway'
import { canonicalJson } from './authorization-pipeline'

const NOW = new Date('2026-09-15T12:00:00.000Z')

class HarnessRepository implements DeviceGatewayRepository {
  identity: AgentIdentity | null = null
  usedNonces = new Set<string>()
  audits: GatewayAudit[] = []
  command: Omit<AgentCommand, 'leaseToken' | 'commandNonce'> | null = {
    id: 'command-1', actionId: 'action-1', taskId: 'task-1', attemptId: 'attempt-1',
    capability: 'filesystem.list', operation: 'filesystem.list', target: 'authorized-root',
    parameters: { relativePath: '.' }, actionFingerprint: 'fingerprint-1', idempotencyKey: 'idempotency-1',
    expiresAt: '2026-09-15T12:05:00.000Z', leaseExpiresAt: '2026-09-15T12:00:30.000Z',
    correlationId: '40000000-0000-4000-8000-000000000001', protocolVersion: 1,
  }
  pairingConsumed = false
  receipt?: GatewayReceipt
  result?: GatewayResult

  async findIdentity(deviceId: string, keyId: string) {
    return this.identity?.deviceId === deviceId && this.identity.keyId === keyId ? this.identity : null
  }
  async registerRequestNonce(input: { nonceHash: string }) {
    if (this.usedNonces.has(input.nonceHash)) return false
    this.usedNonces.add(input.nonceHash); return true
  }
  async createPairingChallenge() { return { id: 'challenge-1' } }
  async consumePairingChallenge(input: { publicKey: string }) {
    if (this.pairingConsumed) throw new Error('single-use')
    this.pairingConsumed = true
    this.identity = {
      id: 'identity-1', ownerId: 'owner-1', deviceId: 'device-1', keyId: 'agent-key-1',
      publicKey: input.publicKey, algorithm: 'ECDSA_P256_SHA256', status: 'active',
      validFrom: NOW.toISOString(), deviceStatus: 'offline',
    }
    return { ownerId: 'owner-1', deviceId: 'device-1', correlationId: '40000000-0000-4000-8000-000000000001', grantedCapabilities: ['filesystem.list'] }
  }
  async rotateIdentity() {}
  async recordHeartbeat() {
    if (this.identity) this.identity = { ...this.identity, deviceStatus: 'online' }
    return { online: true, correlationId: '40000000-0000-4000-8000-000000000001' }
  }
  async acquireCommand() { const command = this.command; this.command = null; return command }
  async recordReceipt(input: { receipt: GatewayReceipt }) { this.receipt = input.receipt; return { correlationId: '40000000-0000-4000-8000-000000000001' } }
  async recordResult(input: { result: GatewayResult }) {
    this.result = input.result
    return { correlationId: input.result.correlationId, taskId: 'task-1', terminal: true, successful: true }
  }
  async revokeDevice() { if (this.identity) this.identity = { ...this.identity, status: 'revoked', deviceStatus: 'revoked' } }
  async audit(event: GatewayAudit) { this.audits.push(event) }
}

async function agentKeys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const publicDer = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey))
  return {
    privateKey: pair.privateKey,
    publicKey: `-----BEGIN PUBLIC KEY-----\n${Buffer.from(publicDer).toString('base64')}\n-----END PUBLIC KEY-----`,
  }
}

async function sign(privateKey: CryptoKey, message: string) {
  const value = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, new TextEncoder().encode(message))
  return Buffer.from(value).toString('base64url')
}

describe('simulated Device Agent HTTPS contract', () => {
  it('runs pairing, signed heartbeat, lease, receipt and structured result with one correlation ID', async () => {
    const repository = new HarnessRepository()
    const gateway = new DeviceGateway(repository, new WebCryptoAgentSignatureVerifier(), { now: () => new Date(NOW) }, { token: () => 'pairing-token-0000000000000000000000000001' })
    const keys = await agentKeys()
    const challenge = await gateway.createPairing({
      ownerId: 'owner-1', friendlyName: 'Harness PC', operatingSystem: 'Windows 11', agentVersion: '0.1.0-harness',
      requestedCapabilities: ['filesystem.list'], requestedTrust: 'temporary',
    })
    const registrationNonce = 'registration-nonce-000000000001'
    const pairingMessage = canonicalPairingProof(challenge.id, await sha256(challenge.token), registrationNonce)
    await gateway.completePairing({
      challengeId: challenge.id, token: challenge.token, keyId: 'agent-key-1', publicKey: keys.publicKey,
      registrationNonce, registrationSignature: await sign(keys.privateKey, pairingMessage),
    })
    const identity = repository.identity!

    let requestNumber = 0
    const authenticate = async (path: string, requestBody: unknown, requestKind: string) => {
      requestNumber += 1
      const nonce = `request-nonce-${requestNumber}`
      const digest = await sha256(canonicalJson(requestBody))
      const message = canonicalAgentRequest('POST', path, NOW.toISOString(), nonce, digest)
      return gateway.authenticate({
        proof: { deviceId: identity.deviceId, keyId: identity.keyId, timestamp: NOW.toISOString(), nonce, bodyDigest: digest, signature: await sign(keys.privateKey, message) },
        method: 'POST', path, body: requestBody, requestKind,
      })
    }

    const heartbeatBody = { agentVersion: '0.1.0-harness', operatingSystem: 'Windows 11', capabilities: ['filesystem.list'] }
    const heartbeatIdentity = await authenticate('/api/device/heartbeat', heartbeatBody, 'heartbeat')
    expect(await gateway.heartbeat({ identity: heartbeatIdentity, ...heartbeatBody })).toMatchObject({ status: 'online' })

    const pollBody = { leaseSeconds: 30 }
    const pollIdentity = await authenticate('/api/device/commands/poll', pollBody, 'command_poll')
    const polled = await gateway.poll({ identity: pollIdentity, leaseSeconds: 30 })
    expect(polled.command).toMatchObject({ operation: 'filesystem.list', capability: 'filesystem.list', correlationId: '40000000-0000-4000-8000-000000000001' })

    const command = polled.command!
    const receipt: GatewayReceipt = { commandId: command.id, attemptId: command.attemptId, leaseToken: command.leaseToken, commandNonce: command.commandNonce, state: 'accepted' }
    await authenticate('/api/device/commands/receipt', receipt, 'command_receipt')
    await gateway.receipt({ identity, receipt, requestNonce: `request-nonce-${requestNumber}` })

    const result: GatewayResult = {
      commandId: command.id, attemptId: command.attemptId, leaseToken: command.leaseToken, commandNonce: command.commandNonce,
      status: 'completed', output: { entries: [{ name: 'example.txt', kind: 'file' }] },
      agentVersion: '0.1.0-harness', correlationId: command.correlationId,
    }
    await authenticate('/api/device/commands/result', result, 'command_result')
    expect(await gateway.result({ identity, result, requestNonce: `request-nonce-${requestNumber}` })).toMatchObject({ terminal: true, successful: true })
    expect(repository.result?.output).toEqual({ entries: [{ name: 'example.txt', kind: 'file' }] })
    expect(repository.audits.filter(event => event.correlationId === command.correlationId).length).toBeGreaterThanOrEqual(5)
  })
})
