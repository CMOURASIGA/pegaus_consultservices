import { describe, expect, it } from 'vitest'
import {
  ApprovalRuntimeError, AuthorizationPipeline, DeterministicDecisionGuard, fingerprintAction,
  type ApprovalRecord, type AuthorizationRepository, type GuardContext, type StructuredAction,
} from './authorization-pipeline'
import type { TaskRecord } from './task-runtime'

const action = (overrides: Partial<StructuredAction> = {}): StructuredAction => ({
  ownerId: 'owner-a', actorId: 'owner-a', sessionId: 'session', taskId: 'task-a', deviceId: 'device-a',
  capability: 'filesystem.list', operation: 'filesystem.list', target: 'documents',
  parameters: { relativePath: '.', maxEntries: 100 }, risk: 'medium',
  approvalRequirement: 'approval', correlationId: 'correlation', protocolVersion: 1,
  idempotencyKey: 'action-1', ...overrides,
})
const context = (overrides: Partial<GuardContext> = {}): GuardContext => ({
  session: { ownerId: 'owner-a', active: true, aal: 'aal2', trust: 'trusted' },
  device: { ownerId: 'owner-a', status: 'online', announcedCapabilities: ['filesystem.list'] },
  grant: { ownerId: 'owner-a', deviceId: 'device-a', capability: 'filesystem.list', status: 'active' },
  operation: { capability: 'filesystem.list', operation: 'filesystem.list', risk: 'medium', enabled: true },
  permission: 'allow', policy: 'allow', now: '2026-09-14T12:00:00.000Z',
  modelOutput: { trust: 'untrusted', executionAuthorization: 'none' }, ...overrides,
})

class FakeAuthorizationRepository implements AuthorizationRepository {
  approvals = new Map<string, ApprovalRecord>()
  commands = new Map<string, Awaited<ReturnType<AuthorizationRepository['createAuthorizedCommand']>>['command']>()
  async createApproval(input: StructuredAction & { actionFingerprint: string; expiresAt: string }) {
    const record: ApprovalRecord = { id: 'approval-1', ownerId: input.ownerId, taskId: input.taskId, deviceId: input.deviceId, capability: input.capability, target: input.target, actionFingerprint: input.actionFingerprint, status: 'pending', expiresAt: input.expiresAt }
    this.approvals.set(record.id, record)
    return record
  }
  async decideApproval(input: { approvalId: string; ownerId: string; decision: 'approved' | 'rejected'; now: string }) {
    const approval = this.approvals.get(input.approvalId)!
    const next = { ...approval, status: input.decision } as ApprovalRecord
    this.approvals.set(next.id, next)
    return next
  }
  async revokeApproval(input: { approvalId: string; ownerId: string; now: string }) {
    const approval = this.approvals.get(input.approvalId)!
    const next = { ...approval, status: 'revoked' as const }
    this.approvals.set(next.id, next)
    return next
  }
  async createAuthorizedCommand(input: { action: StructuredAction; actionFingerprint: string; approvalId?: string; expiresAt: string; commandNonceHash: string }) {
    const existing = this.commands.get(input.action.idempotencyKey)
    if (existing) return { command: existing, created: false }
    const command = { id: 'command-1', actionId: 'action-id', taskId: input.action.taskId, deviceId: input.action.deviceId, capability: input.action.capability, operation: input.action.operation, target: input.action.target, parameters: input.action.parameters, actionFingerprint: input.actionFingerprint, idempotencyKey: input.action.idempotencyKey, correlationId: input.action.correlationId, expiresAt: input.expiresAt, status: 'queued' as const }
    this.commands.set(input.action.idempotencyKey, command)
    if (input.approvalId) {
      const approval = this.approvals.get(input.approvalId)
      if (!approval || approval.status !== 'approved' || approval.actionFingerprint !== input.actionFingerprint) throw new ApprovalRuntimeError('APPROVAL_NOT_USABLE')
      this.approvals.set(approval.id, { ...approval, status: 'consumed' })
    }
    return { command, created: true }
  }
}

const task: TaskRecord = { id: 'task-a', ownerId: 'owner-a', status: 'running', stateVersion: 2, progress: 20 }
const tasks = { waitForApproval: async () => ({ ...task, status: 'waiting_approval' as const }), waitForDevice: async () => ({ ...task, status: 'waiting_device' as const }) }

describe('DeterministicDecisionGuard', () => {
  it('ignores model attempts to self-authorize and still requires approval', () => {
    const result = new DeterministicDecisionGuard().evaluate(action(), context({ modelOutput: { trust: 'untrusted', executionAuthorization: 'none' } }))
    expect(result.decision).toBe('approval_required')
  })
  it('fails closed when policy is unknown', () => {
    expect(new DeterministicDecisionGuard().evaluate(action(), context({ policy: 'unknown' }))).toMatchObject({ decision: 'unknown', effectiveCapability: false })
  })
  it('rejects an unknown capability and a capability not granted', () => {
    expect(new DeterministicDecisionGuard().evaluate(action(), context({ operation: undefined })).reason).toBe('capability_unknown')
    expect(new DeterministicDecisionGuard().evaluate(action(), context({ grant: undefined })).reason).toBe('capability_not_granted')
  })
  it('uses the intersection of announced and granted capabilities', () => {
    expect(new DeterministicDecisionGuard().evaluate(action(), context({ device: { ownerId: 'owner-a', status: 'online', announcedCapabilities: [] } })).reason).toBe('capability_not_announced')
    expect(new DeterministicDecisionGuard().evaluate(action(), context()).effectiveCapability).toBe(true)
  })
  it('rejects cross-owner Task or device context', () => {
    expect(new DeterministicDecisionGuard().evaluate(action({ ownerId: 'owner-b', actorId: 'owner-b' }), context()).reason).toBe('owner_mismatch')
    expect(new DeterministicDecisionGuard().evaluate(action(), context({ device: { ownerId: 'owner-b', status: 'online', announcedCapabilities: ['filesystem.list'] } })).reason).toBe('owner_mismatch')
  })
  it('moves an authorized request to waiting_device when offline', async () => {
    const repository = new FakeAuthorizationRepository()
    const pipeline = new AuthorizationPipeline(new DeterministicDecisionGuard(), repository, tasks)
    expect((await pipeline.prepare({ action: action(), context: context({ device: { ownerId: 'owner-a', status: 'offline', announcedCapabilities: ['filesystem.list'] } }), task, approvalTtlMs: 1000, commandTtlMs: 1000, commandNonceHash: 'nonce' })).status).toBe('waiting_device')
  })
})

describe('Approval and command pipeline', () => {
  it('creates an approval request instead of a command', async () => {
    const repository = new FakeAuthorizationRepository()
    const pipeline = new AuthorizationPipeline(new DeterministicDecisionGuard(), repository, tasks)
    const result = await pipeline.prepare({ action: action(), context: context(), task, approvalTtlMs: 60_000, commandTtlMs: 60_000, commandNonceHash: 'nonce' })
    expect(result.status).toBe('waiting_approval')
    expect(repository.commands.size).toBe(0)
  })
  it('rejects changed payload after approval', async () => {
    const repository = new FakeAuthorizationRepository()
    const pipeline = new AuthorizationPipeline(new DeterministicDecisionGuard(), repository, tasks)
    const original = action()
    const fingerprint = await fingerprintAction(original)
    const approval = await repository.createApproval({ ...original, actionFingerprint: fingerprint, expiresAt: '2026-09-14T13:00:00.000Z' })
    const approved = await repository.decideApproval({ approvalId: approval.id, ownerId: approval.ownerId, decision: 'approved', now: '2026-09-14T12:01:00.000Z' })
    await expect(pipeline.continueApproved({ action: action({ parameters: { relativePath: 'changed' } }), approval: approved, now: '2026-09-14T12:02:00.000Z', expiresAt: '2026-09-14T13:00:00.000Z', commandNonceHash: 'nonce' })).rejects.toMatchObject({ code: 'FINGERPRINT_MISMATCH' })
  })
  it.each(['expired', 'revoked', 'consumed'] as const)('rejects %s approval', async status => {
    const repository = new FakeAuthorizationRepository()
    const pipeline = new AuthorizationPipeline(new DeterministicDecisionGuard(), repository, tasks)
    const proposed = action()
    const fingerprint = await fingerprintAction(proposed)
    const approval: ApprovalRecord = { id: 'a', ownerId: proposed.ownerId, taskId: proposed.taskId, deviceId: proposed.deviceId, capability: proposed.capability, target: proposed.target, actionFingerprint: fingerprint, status, expiresAt: '2026-09-14T13:00:00.000Z' }
    await expect(pipeline.continueApproved({ action: proposed, approval, now: '2026-09-14T12:00:00.000Z', expiresAt: '2026-09-14T13:00:00.000Z', commandNonceHash: 'nonce' })).rejects.toMatchObject({ code: 'APPROVAL_NOT_USABLE' })
  })
  it('rejects approval from another task or owner', async () => {
    const repository = new FakeAuthorizationRepository()
    const pipeline = new AuthorizationPipeline(new DeterministicDecisionGuard(), repository, tasks)
    const proposed = action()
    const fingerprint = await fingerprintAction(proposed)
    for (const approval of [
      { id: 'a', ownerId: 'other', taskId: proposed.taskId },
      { id: 'b', ownerId: proposed.ownerId, taskId: 'other' },
    ]) {
      await expect(pipeline.continueApproved({ action: proposed, approval: { ...approval, deviceId: proposed.deviceId, capability: proposed.capability, target: proposed.target, actionFingerprint: fingerprint, status: 'approved', expiresAt: '2026-09-14T13:00:00.000Z' }, now: '2026-09-14T12:00:00.000Z', expiresAt: '2026-09-14T13:00:00.000Z', commandNonceHash: 'nonce' })).rejects.toMatchObject({ code: 'APPROVAL_SCOPE_MISMATCH' })
    }
  })
  it('consumes approval once and deduplicates command by idempotency key', async () => {
    const repository = new FakeAuthorizationRepository()
    const pipeline = new AuthorizationPipeline(new DeterministicDecisionGuard(), repository, tasks)
    const proposed = action()
    const fingerprint = await fingerprintAction(proposed)
    const pending = await repository.createApproval({ ...proposed, actionFingerprint: fingerprint, expiresAt: '2026-09-14T13:00:00.000Z' })
    const approved = await repository.decideApproval({ approvalId: pending.id, ownerId: pending.ownerId, decision: 'approved', now: '2026-09-14T12:00:00.000Z' })
    expect((await pipeline.continueApproved({ action: proposed, approval: approved, now: '2026-09-14T12:01:00.000Z', expiresAt: '2026-09-14T13:00:00.000Z', commandNonceHash: 'nonce' })).created).toBe(true)
    await expect(pipeline.continueApproved({ action: proposed, approval: repository.approvals.get(approved.id)!, now: '2026-09-14T12:02:00.000Z', expiresAt: '2026-09-14T13:00:00.000Z', commandNonceHash: 'nonce2' })).rejects.toMatchObject({ code: 'APPROVAL_NOT_USABLE' })
    expect(repository.commands.size).toBe(1)
  })
  it('canonical fingerprint is stable across property order', async () => {
    const left = await fingerprintAction(action({ parameters: { b: 2, a: 1 } }))
    const right = await fingerprintAction(action({ parameters: { a: 1, b: 2 } }))
    expect(left).toBe(right)
  })
})
