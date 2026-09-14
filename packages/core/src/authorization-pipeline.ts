export type GuardDecision = 'proceed' | 'approval_required' | 'reject' | 'unknown'
export type OperationalRisk = 'low' | 'medium' | 'high' | 'critical'
export type ApprovalRequirement = 'none' | 'approval' | 'strong_approval'

export type StructuredAction = {
  ownerId: string
  actorId: string
  sessionId: string
  taskId: string
  deviceId: string
  capability: string
  operation: string
  target: string
  parameters: Readonly<Record<string, unknown>>
  risk: OperationalRisk
  approvalRequirement: ApprovalRequirement
  correlationId: string
  protocolVersion: 1
  idempotencyKey: string
}

export type GuardContext = {
  session: { ownerId: string; active: boolean; aal: 'aal1' | 'aal2'; trust: 'untrusted' | 'temporary' | 'trusted' }
  device: { ownerId: string; status: 'offline' | 'online' | 'revoked'; announcedCapabilities: readonly string[] }
  grant?: { ownerId: string; deviceId: string; capability: string; status: 'active' | 'expired' | 'revoked'; expiresAt?: string }
  operation?: { capability: string; operation: string; risk: OperationalRisk; enabled: boolean }
  permission: 'allow' | 'deny' | 'unknown'
  policy: 'allow' | 'deny' | 'unknown'
  now: string
  modelOutput?: { trust: 'untrusted'; executionAuthorization: 'none' }
}

export type GuardEvaluation = {
  decision: GuardDecision
  reason:
    | 'authorized' | 'approval_required' | 'owner_mismatch' | 'inactive_session'
    | 'device_offline' | 'device_revoked' | 'capability_unknown'
    | 'capability_not_announced' | 'capability_not_granted' | 'grant_expired'
    | 'permission_denied' | 'policy_denied' | 'step_up_required' | 'indeterminate'
  effectiveCapability: boolean
}

export class DeterministicDecisionGuard {
  evaluate(action: StructuredAction, context: GuardContext): GuardEvaluation {
    if (
      action.ownerId !== action.actorId ||
      context.session.ownerId !== action.ownerId ||
      context.device.ownerId !== action.ownerId ||
      (context.grant && (context.grant.ownerId !== action.ownerId || context.grant.deviceId !== action.deviceId))
    ) return deny('owner_mismatch')

    if (!context.session.active) return deny('inactive_session')
    if (context.device.status === 'revoked') return deny('device_revoked')
    if (context.device.status === 'offline') return unknown('device_offline')
    if (!context.operation || !context.operation.enabled || context.operation.capability !== action.capability || context.operation.operation !== action.operation) {
      return deny('capability_unknown')
    }
    if (!context.device.announcedCapabilities.includes(action.capability)) return deny('capability_not_announced')
    if (!context.grant || context.grant.capability !== action.capability || context.grant.status !== 'active') return deny('capability_not_granted')
    if (context.grant.expiresAt && Date.parse(context.grant.expiresAt) <= Date.parse(context.now)) return deny('grant_expired')
    if (context.permission === 'deny') return deny('permission_denied')
    if (context.policy === 'deny') return deny('policy_denied')
    if (context.permission === 'unknown' || context.policy === 'unknown') return unknown('indeterminate')

    const required = strongestRequirement(action.approvalRequirement, context.operation.risk)
    if (required === 'strong_approval' && (context.session.aal !== 'aal2' || context.session.trust !== 'trusted')) {
      return { decision: 'approval_required', reason: 'step_up_required', effectiveCapability: true }
    }
    if (required !== 'none') return { decision: 'approval_required', reason: 'approval_required', effectiveCapability: true }
    return { decision: 'proceed', reason: 'authorized', effectiveCapability: true }
  }
}

const deny = (reason: GuardEvaluation['reason']): GuardEvaluation => ({ decision: 'reject', reason, effectiveCapability: false })
const unknown = (reason: GuardEvaluation['reason']): GuardEvaluation => ({ decision: 'unknown', reason, effectiveCapability: false })

function strongestRequirement(configured: ApprovalRequirement, risk: OperationalRisk): ApprovalRequirement {
  if (risk === 'critical' || configured === 'strong_approval') return 'strong_approval'
  if (risk === 'high' || risk === 'medium' || configured === 'approval') return 'approval'
  return 'none'
}

export type ApprovalRecord = {
  id: string
  ownerId: string
  taskId: string
  deviceId: string
  capability: string
  target: string
  actionFingerprint: string
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'revoked' | 'consumed'
  expiresAt: string
}

export type AuthorizedCommand = {
  id: string
  actionId: string
  taskId: string
  deviceId: string
  capability: string
  operation: string
  target: string
  parameters: Readonly<Record<string, unknown>>
  actionFingerprint: string
  idempotencyKey: string
  correlationId: string
  expiresAt: string
  status: 'queued'
}

export interface AuthorizationRepository {
  createApproval(input: StructuredAction & { actionFingerprint: string; expiresAt: string }): Promise<ApprovalRecord>
  decideApproval(input: { approvalId: string; ownerId: string; decision: 'approved' | 'rejected'; now: string }): Promise<ApprovalRecord>
  revokeApproval(input: { approvalId: string; ownerId: string; now: string }): Promise<ApprovalRecord>
  createAuthorizedCommand(input: {
    action: StructuredAction
    actionFingerprint: string
    approvalId?: string
    expiresAt: string
    commandNonceHash: string
  }): Promise<{ command: AuthorizedCommand; created: boolean }>
}

export class ApprovalRuntimeError extends Error {
  constructor(readonly code: 'FINGERPRINT_MISMATCH' | 'APPROVAL_NOT_USABLE' | 'APPROVAL_SCOPE_MISMATCH') {
    super(code)
    this.name = 'ApprovalRuntimeError'
  }
}

export class AuthorizationPipeline {
  constructor(
    private readonly guard: DeterministicDecisionGuard,
    private readonly repository: AuthorizationRepository,
    private readonly taskRuntime: {
      waitForApproval(task: import('./task-runtime').TaskRecord, correlationId: string): Promise<import('./task-runtime').TaskRecord>
      waitForDevice(task: import('./task-runtime').TaskRecord, correlationId: string): Promise<import('./task-runtime').TaskRecord>
    },
  ) {}

  async prepare(input: {
    action: StructuredAction
    context: GuardContext
    task: import('./task-runtime').TaskRecord
    approvalTtlMs: number
    commandTtlMs: number
    commandNonceHash: string
  }): Promise<
    | { status: 'authorized'; command: AuthorizedCommand; created: boolean }
    | { status: 'waiting_approval'; approval: ApprovalRecord }
    | { status: 'waiting_device' }
    | { status: 'rejected' | 'unknown'; evaluation: GuardEvaluation }
  > {
    const evaluation = this.guard.evaluate(input.action, input.context)
    if (evaluation.decision === 'reject' || (evaluation.decision === 'unknown' && evaluation.reason !== 'device_offline')) {
      return { status: evaluation.decision, evaluation }
    }
    if (evaluation.reason === 'device_offline') {
      await this.taskRuntime.waitForDevice(input.task, input.action.correlationId)
      return { status: 'waiting_device' }
    }
    const fingerprint = await fingerprintAction(input.action)
    if (evaluation.decision === 'approval_required') {
      const approval = await this.repository.createApproval({
        ...input.action,
        actionFingerprint: fingerprint,
        expiresAt: new Date(Date.parse(input.context.now) + input.approvalTtlMs).toISOString(),
      })
      await this.taskRuntime.waitForApproval(input.task, input.action.correlationId)
      return { status: 'waiting_approval', approval }
    }
    const created = await this.repository.createAuthorizedCommand({
      action: input.action,
      actionFingerprint: fingerprint,
      expiresAt: new Date(Date.parse(input.context.now) + input.commandTtlMs).toISOString(),
      commandNonceHash: input.commandNonceHash,
    })
    return { status: 'authorized', ...created }
  }

  async continueApproved(input: {
    action: StructuredAction
    approval: ApprovalRecord
    now: string
    expiresAt: string
    commandNonceHash: string
  }): Promise<{ command: AuthorizedCommand; created: boolean }> {
    const fingerprint = await fingerprintAction(input.action)
    if (fingerprint !== input.approval.actionFingerprint) throw new ApprovalRuntimeError('FINGERPRINT_MISMATCH')
    if (
      input.approval.ownerId !== input.action.ownerId ||
      input.approval.taskId !== input.action.taskId ||
      input.approval.deviceId !== input.action.deviceId ||
      input.approval.capability !== input.action.capability ||
      input.approval.target !== input.action.target
    ) throw new ApprovalRuntimeError('APPROVAL_SCOPE_MISMATCH')
    if (input.approval.status !== 'approved' || Date.parse(input.approval.expiresAt) <= Date.parse(input.now)) {
      throw new ApprovalRuntimeError('APPROVAL_NOT_USABLE')
    }
    return this.repository.createAuthorizedCommand({
      action: input.action, actionFingerprint: fingerprint, approvalId: input.approval.id,
      expiresAt: input.expiresAt, commandNonceHash: input.commandNonceHash,
    })
  }
}

export async function fingerprintAction(action: StructuredAction): Promise<string> {
  const canonical = canonicalJson({
    ownerId: action.ownerId, taskId: action.taskId, deviceId: action.deviceId,
    capability: action.capability, operation: action.operation, target: action.target,
    parameters: action.parameters, risk: action.risk, protocolVersion: action.protocolVersion,
  })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
}
