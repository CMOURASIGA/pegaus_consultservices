import 'server-only'

import {
  ApprovalRuntimeError, TaskRuntimeError,
  type ApprovalRecord, type AuthorizationRepository, type AuthorizedCommand,
  type StructuredAction, type TaskRecord, type TaskRuntimeRepository, type TaskTransition,
} from '@pegasus/core'
import { AppError } from '@pegasus/shared'
import type { SupabaseClient } from '@supabase/supabase-js'

type TaskRow = { id: string; owner_id: string; status: TaskRecord['status']; state_version: number; progress: number; idempotency_key: string | null; result_summary: string | null; error_summary: string | null }
type ApprovalRow = { id: string; owner_id: string; task_id: string; device_id: string; capability: string; target: string; action_fingerprint: string; status: ApprovalRecord['status']; expires_at: string }
type CommandRow = { id: string; action_id: string; task_id: string; device_id: string; capability: string; operation: string; target: string; parameters: Readonly<Record<string, unknown>>; action_fingerprint: string; idempotency_key: string; correlation_id: string; expires_at: string; status: 'queued' }

const taskFromRow = (row: TaskRow): TaskRecord => ({
  id: row.id, ownerId: row.owner_id, status: row.status, stateVersion: row.state_version,
  progress: Number(row.progress), idempotencyKey: row.idempotency_key ?? undefined,
  resultSummary: row.result_summary ?? undefined, errorSummary: row.error_summary ?? undefined,
})
const approvalFromRow = (row: ApprovalRow): ApprovalRecord => ({
  id: row.id, ownerId: row.owner_id, taskId: row.task_id, deviceId: row.device_id,
  capability: row.capability, target: row.target, actionFingerprint: row.action_fingerprint,
  status: row.status, expiresAt: row.expires_at,
})
const commandFromRow = (row: CommandRow): AuthorizedCommand => ({
  id: row.id, actionId: row.action_id, taskId: row.task_id, deviceId: row.device_id,
  capability: row.capability, operation: row.operation, target: row.target,
  parameters: row.parameters, actionFingerprint: row.action_fingerprint,
  idempotencyKey: row.idempotency_key, correlationId: row.correlation_id,
  expiresAt: row.expires_at, status: row.status,
})

export class SupabaseOperationalRepository implements TaskRuntimeRepository, AuthorizationRepository {
  constructor(private readonly client: SupabaseClient) {}

  async create(input: { ownerId: string; title: string; objective?: string; idempotencyKey: string; correlationId: string }) {
    const payload = { owner_id: input.ownerId, title: input.title, objective: input.objective, idempotency_key: input.idempotencyKey, correlation_id: input.correlationId }
    const inserted = await this.client.from('tasks').upsert(payload, { onConflict: 'owner_id,idempotency_key', ignoreDuplicates: true }).select('id,owner_id,status,state_version,progress,idempotency_key,result_summary,error_summary').maybeSingle()
    if (inserted.error) throw new AppError('TASK_CREATE_FAILED', 'Não foi possível criar a tarefa.', 503)
    if (inserted.data) return { task: taskFromRow(inserted.data as TaskRow), created: true }
    const existing = await this.client.from('tasks').select('id,owner_id,status,state_version,progress,idempotency_key,result_summary,error_summary').eq('owner_id', input.ownerId).eq('idempotency_key', input.idempotencyKey).single()
    if (existing.error || !existing.data) throw new AppError('TASK_CREATE_FAILED', 'Não foi possível recuperar a tarefa.', 503)
    return { task: taskFromRow(existing.data as TaskRow), created: false }
  }

  async transition(input: TaskTransition) {
    const { data, error } = await this.client.rpc('transition_task', {
      p_task_id: input.taskId, p_owner_id: input.ownerId, p_from_status: input.from,
      p_to_status: input.to, p_expected_version: input.expectedVersion,
      p_progress: input.progress ?? null, p_result_summary: input.resultSummary ?? null,
      p_error_summary: input.errorSummary ?? null,
    }).single()
    if (error) {
      if (error.code === '40001') throw new TaskRuntimeError('CONCURRENT_TRANSITION', 'Concurrent transition')
      if (error.code === '22023') throw new TaskRuntimeError('INVALID_TRANSITION', 'Invalid transition')
      throw new AppError('TASK_TRANSITION_FAILED', 'Não foi possível atualizar a tarefa.', 503)
    }
    return taskFromRow(data as TaskRow)
  }

  async get(taskId: string, ownerId: string) {
    const { data, error } = await this.client.from('tasks').select('id,owner_id,status,state_version,progress,idempotency_key,result_summary,error_summary').eq('id', taskId).eq('owner_id', ownerId).maybeSingle()
    if (error) throw new AppError('TASK_READ_FAILED', 'Não foi possível carregar a tarefa.', 503)
    return data ? taskFromRow(data as TaskRow) : null
  }

  async hasValidatedSuccessfulResult(taskId: string, ownerId: string) {
    const commands = await this.client.from('device_commands').select('id').eq('task_id', taskId).eq('owner_id', ownerId)
    if (commands.error) throw new AppError('TASK_RESULT_CHECK_FAILED', 'Não foi possível validar o resultado.', 503)
    const commandIds = (commands.data as { id: string }[]).map(item => item.id)
    if (commandIds.length === 0) return false
    const results = await this.client.from('device_command_results').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId).eq('status', 'completed').in('command_id', commandIds)
    if (results.error) throw new AppError('TASK_RESULT_CHECK_FAILED', 'Não foi possível validar o resultado.', 503)
    return (results.count ?? 0) > 0
  }

  async recordAudit(input: { ownerId: string; taskId: string; correlationId: string; action: string; outcome: 'success' | 'denied' | 'failed'; metadata: Readonly<Record<string, string | number | boolean | null>> }) {
    const { error } = await this.client.from('audit_events').insert({
      owner_id: input.ownerId, actor_type: 'system', action: input.action,
      target_type: 'task', target_ref: input.taskId, outcome: input.outcome,
      correlation_id: input.correlationId, metadata: input.metadata,
    })
    if (error) throw new AppError('AUDIT_WRITE_FAILED', 'Não foi possível registrar a auditoria.', 503)
  }

  async createApproval(input: StructuredAction & { actionFingerprint: string; expiresAt: string }) {
    const { data, error } = await this.client.rpc('request_device_action_approval', {
      p_owner_id: input.ownerId, p_task_id: input.taskId, p_device_id: input.deviceId,
      p_capability: input.capability, p_target: input.target, p_action_type: input.operation,
      p_action_payload: input.parameters, p_action_fingerprint: input.actionFingerprint,
      p_approval_level: input.approvalRequirement === 'strong_approval' ? 'strong_approval' : 'approval',
      p_risk_level: input.risk, p_expires_at: input.expiresAt, p_correlation_id: input.correlationId,
    }).single()
    if (error || !data) throw new AppError('APPROVAL_CREATE_FAILED', 'Não foi possível solicitar aprovação.', 503)
    return approvalFromRow(data as ApprovalRow)
  }

  async decideApproval(input: { approvalId: string; ownerId: string; decision: 'approved' | 'rejected'; now: string }) {
    const { data, error } = await this.client.rpc('decide_device_action_approval', {
      p_approval_id: input.approvalId, p_owner_id: input.ownerId, p_decision: input.decision,
    }).single()
    if (error || !data) throw new ApprovalRuntimeError('APPROVAL_NOT_USABLE')
    return approvalFromRow(data as ApprovalRow)
  }

  async revokeApproval(input: { approvalId: string; ownerId: string; now: string }) {
    const { data, error } = await this.client.rpc('revoke_device_action_approval', {
      p_approval_id: input.approvalId, p_owner_id: input.ownerId,
    }).single()
    if (error || !data) throw new ApprovalRuntimeError('APPROVAL_NOT_USABLE')
    return approvalFromRow(data as ApprovalRow)
  }

  async createAuthorizedCommand(input: { action: StructuredAction; actionFingerprint: string; approvalId?: string; expiresAt: string; commandNonceHash: string }) {
    const { data, error } = await this.client.rpc('create_authorized_device_command', {
      p_owner_id: input.action.ownerId, p_task_id: input.action.taskId,
      p_device_id: input.action.deviceId, p_approval_id: input.approvalId ?? null,
      p_capability: input.action.capability, p_operation: input.action.operation,
      p_target: input.action.target, p_parameters: input.action.parameters,
      p_action_fingerprint: input.actionFingerprint, p_idempotency_key: input.action.idempotencyKey,
      p_command_nonce_hash: input.commandNonceHash, p_expires_at: input.expiresAt,
      p_correlation_id: input.action.correlationId,
    }).single()
    if (error || !data) throw new ApprovalRuntimeError('APPROVAL_NOT_USABLE')
    const envelope = data as { command: CommandRow; created: boolean }
    return { command: commandFromRow(envelope.command), created: envelope.created }
  }
}
