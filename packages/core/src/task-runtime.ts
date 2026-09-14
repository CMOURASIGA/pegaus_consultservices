export type TaskStatus =
  | 'planning' | 'queued' | 'running' | 'waiting_external'
  | 'waiting_approval' | 'waiting_device' | 'paused' | 'completed'
  | 'partially_completed' | 'failed' | 'cancelled' | 'expired'

export type TaskRecord = {
  id: string
  ownerId: string
  status: TaskStatus
  stateVersion: number
  progress: number
  idempotencyKey?: string
  resultSummary?: string
  errorSummary?: string
}

export type TaskTransition = {
  taskId: string
  ownerId: string
  from: TaskStatus
  to: TaskStatus
  expectedVersion: number
  progress?: number
  resultSummary?: string
  errorSummary?: string
  correlationId: string
}

export interface TaskRuntimeRepository {
  create(input: {
    ownerId: string
    title: string
    objective?: string
    idempotencyKey: string
    correlationId: string
  }): Promise<{ task: TaskRecord; created: boolean }>
  transition(input: TaskTransition): Promise<TaskRecord>
  get(taskId: string, ownerId: string): Promise<TaskRecord | null>
  hasValidatedSuccessfulResult(taskId: string, ownerId: string): Promise<boolean>
  recordAudit(input: {
    ownerId: string
    taskId: string
    correlationId: string
    action: string
    outcome: 'success' | 'denied' | 'failed'
    metadata: Readonly<Record<string, string | number | boolean | null>>
  }): Promise<void>
}

const transitions: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  planning: ['queued', 'cancelled', 'failed'],
  queued: ['running', 'waiting_device', 'cancelled', 'failed', 'expired'],
  running: ['waiting_approval', 'waiting_device', 'paused', 'completed', 'partially_completed', 'failed', 'cancelled'],
  waiting_external: ['queued', 'running', 'cancelled', 'failed', 'expired'],
  waiting_approval: ['queued', 'running', 'cancelled', 'failed', 'expired'],
  waiting_device: ['queued', 'running', 'cancelled', 'failed', 'expired'],
  paused: ['queued', 'cancelled'],
  completed: [],
  partially_completed: [],
  failed: [],
  cancelled: [],
  expired: [],
}

export class TaskRuntimeError extends Error {
  constructor(
    readonly code: 'INVALID_TRANSITION' | 'TASK_NOT_FOUND' | 'RESULT_NOT_VALIDATED' | 'CONCURRENT_TRANSITION',
    message: string,
  ) {
    super(message)
    this.name = 'TaskRuntimeError'
  }
}

export class TaskRuntime {
  constructor(private readonly repository: TaskRuntimeRepository) {}

  create(input: {
    ownerId: string
    title: string
    objective?: string
    idempotencyKey: string
    correlationId: string
  }) {
    if (!input.idempotencyKey.trim()) throw new TypeError('idempotencyKey is required')
    return this.repository.create(input)
  }

  async transition(input: TaskTransition): Promise<TaskRecord> {
    if (!transitions[input.from].includes(input.to)) {
      await this.auditDenied(input, 'invalid_transition')
      throw new TaskRuntimeError('INVALID_TRANSITION', `Invalid task transition: ${input.from} -> ${input.to}`)
    }
    if (input.progress !== undefined && (input.progress < 0 || input.progress > 100)) {
      await this.auditDenied(input, 'invalid_progress')
      throw new TaskRuntimeError('INVALID_TRANSITION', 'Progress must be between 0 and 100')
    }
    if (input.to === 'completed') {
      const valid = await this.repository.hasValidatedSuccessfulResult(input.taskId, input.ownerId)
      if (!valid) {
        await this.auditDenied(input, 'result_not_validated')
        throw new TaskRuntimeError('RESULT_NOT_VALIDATED', 'A validated successful result is required')
      }
    }
    const task = await this.repository.transition(input)
    await this.repository.recordAudit({
      ownerId: input.ownerId,
      taskId: input.taskId,
      correlationId: input.correlationId,
      action: 'task.transition',
      outcome: 'success',
      metadata: { from: input.from, to: input.to, stateVersion: task.stateVersion },
    })
    return task
  }

  waitForApproval(task: TaskRecord, correlationId: string) {
    return this.transition({
      taskId: task.id, ownerId: task.ownerId, from: task.status,
      to: 'waiting_approval', expectedVersion: task.stateVersion, correlationId,
    })
  }

  waitForDevice(task: TaskRecord, correlationId: string) {
    return this.transition({
      taskId: task.id, ownerId: task.ownerId, from: task.status,
      to: 'waiting_device', expectedVersion: task.stateVersion, correlationId,
    })
  }

  cancel(task: TaskRecord, correlationId: string) {
    return this.transition({
      taskId: task.id, ownerId: task.ownerId, from: task.status,
      to: 'cancelled', expectedVersion: task.stateVersion, correlationId,
    })
  }

  resume(task: TaskRecord, correlationId: string) {
    if (task.status !== 'waiting_device' && task.status !== 'waiting_approval' && task.status !== 'paused') {
      return Promise.reject(new TaskRuntimeError('INVALID_TRANSITION', 'Task is not resumable'))
    }
    return this.transition({
      taskId: task.id, ownerId: task.ownerId, from: task.status,
      to: 'queued', expectedVersion: task.stateVersion, correlationId,
    })
  }

  fail(task: TaskRecord, errorSummary: string, correlationId: string) {
    return this.transition({
      taskId: task.id, ownerId: task.ownerId, from: task.status,
      to: 'failed', expectedVersion: task.stateVersion, errorSummary, correlationId,
    })
  }

  expire(task: TaskRecord, correlationId: string) {
    return this.transition({
      taskId: task.id, ownerId: task.ownerId, from: task.status,
      to: 'expired', expectedVersion: task.stateVersion, correlationId,
    })
  }

  complete(task: TaskRecord, resultSummary: string, correlationId: string) {
    return this.transition({
      taskId: task.id, ownerId: task.ownerId, from: task.status,
      to: 'completed', expectedVersion: task.stateVersion, progress: 100,
      resultSummary, correlationId,
    })
  }

  private auditDenied(input: TaskTransition, reason: string) {
    return this.repository.recordAudit({
      ownerId: input.ownerId,
      taskId: input.taskId,
      correlationId: input.correlationId,
      action: 'task.transition',
      outcome: 'denied',
      metadata: { from: input.from, to: input.to, reason },
    })
  }
}
