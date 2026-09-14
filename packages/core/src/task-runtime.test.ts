import { describe, expect, it } from 'vitest'
import { TaskRuntime, TaskRuntimeError, type TaskRecord, type TaskRuntimeRepository, type TaskTransition } from './task-runtime'

class FakeRepository implements TaskRuntimeRepository {
  tasks = new Map<string, TaskRecord>()
  keys = new Map<string, string>()
  audits: { action: string; outcome: string; metadata: Readonly<Record<string, unknown>> }[] = []
  validatedResults = new Set<string>()
  nextId = 1

  async create(input: { ownerId: string; title: string; objective?: string; idempotencyKey: string; correlationId: string }) {
    const key = `${input.ownerId}:${input.idempotencyKey}`
    const existing = this.keys.get(key)
    if (existing) return { task: this.tasks.get(existing)!, created: false }
    const task: TaskRecord = { id: String(this.nextId++), ownerId: input.ownerId, status: 'planning', stateVersion: 0, progress: 0, idempotencyKey: input.idempotencyKey }
    this.tasks.set(task.id, task)
    this.keys.set(key, task.id)
    return { task, created: true }
  }

  async transition(input: TaskTransition) {
    const current = this.tasks.get(input.taskId)
    if (!current || current.ownerId !== input.ownerId) throw new TaskRuntimeError('TASK_NOT_FOUND', 'Task not found')
    if (current.status !== input.from || current.stateVersion !== input.expectedVersion) {
      throw new TaskRuntimeError('CONCURRENT_TRANSITION', 'Concurrent transition')
    }
    const next: TaskRecord = {
      ...current, status: input.to, stateVersion: current.stateVersion + 1,
      progress: input.progress ?? current.progress,
      resultSummary: input.resultSummary ?? current.resultSummary,
      errorSummary: input.errorSummary ?? current.errorSummary,
    }
    this.tasks.set(next.id, next)
    return next
  }

  async get(taskId: string, ownerId: string) {
    const task = this.tasks.get(taskId)
    return task?.ownerId === ownerId ? task : null
  }

  async hasValidatedSuccessfulResult(taskId: string) {
    return this.validatedResults.has(taskId)
  }

  async recordAudit(input: { action: string; outcome: 'success' | 'denied' | 'failed'; metadata: Readonly<Record<string, string | number | boolean | null>> }) {
    this.audits.push(input)
  }
}

describe('TaskRuntime', () => {
  it('creates one task for a repeated owner idempotency key', async () => {
    const repository = new FakeRepository()
    const runtime = new TaskRuntime(repository)
    const input = { ownerId: 'owner', title: 'List files', idempotencyKey: 'interaction:1', correlationId: 'correlation' }
    expect((await runtime.create(input)).created).toBe(true)
    expect((await runtime.create(input)).created).toBe(false)
    expect(repository.tasks.size).toBe(1)
  })

  it('runs the explicit happy-path state machine', async () => {
    const repository = new FakeRepository()
    const runtime = new TaskRuntime(repository)
    let task = (await runtime.create({ ownerId: 'owner', title: 'List files', idempotencyKey: 'one', correlationId: 'c' })).task
    task = await runtime.transition({ taskId: task.id, ownerId: task.ownerId, from: 'planning', to: 'queued', expectedVersion: task.stateVersion, correlationId: 'c' })
    task = await runtime.transition({ taskId: task.id, ownerId: task.ownerId, from: 'queued', to: 'running', expectedVersion: task.stateVersion, correlationId: 'c' })
    repository.validatedResults.add(task.id)
    task = await runtime.complete(task, '3 entries', 'c')
    expect(task).toMatchObject({ status: 'completed', progress: 100, resultSummary: '3 entries', stateVersion: 3 })
  })

  it('rejects an invalid transition and audits the denial', async () => {
    const repository = new FakeRepository()
    const runtime = new TaskRuntime(repository)
    const task = (await runtime.create({ ownerId: 'owner', title: 'Task', idempotencyKey: 'one', correlationId: 'c' })).task
    await expect(runtime.transition({ taskId: task.id, ownerId: task.ownerId, from: 'planning', to: 'completed', expectedVersion: 0, correlationId: 'c' }))
      .rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
    expect(repository.audits.at(-1)).toMatchObject({ outcome: 'denied', metadata: { reason: 'invalid_transition' } })
  })

  it('requires a validated result before completion', async () => {
    const repository = new FakeRepository()
    const runtime = new TaskRuntime(repository)
    const created = (await runtime.create({ ownerId: 'owner', title: 'Task', idempotencyKey: 'one', correlationId: 'c' })).task
    const queued = await runtime.transition({ taskId: created.id, ownerId: created.ownerId, from: 'planning', to: 'queued', expectedVersion: 0, correlationId: 'c' })
    const running = await runtime.transition({ taskId: queued.id, ownerId: queued.ownerId, from: 'queued', to: 'running', expectedVersion: 1, correlationId: 'c' })
    await expect(runtime.complete(running, 'untrusted result', 'c')).rejects.toMatchObject({ code: 'RESULT_NOT_VALIDATED' })
    expect(repository.tasks.get(running.id)?.status).toBe('running')
  })

  it('supports waiting approval, waiting device and idempotent-versioned resume', async () => {
    const repository = new FakeRepository()
    const runtime = new TaskRuntime(repository)
    const created = (await runtime.create({ ownerId: 'owner', title: 'Task', idempotencyKey: 'one', correlationId: 'c' })).task
    const queued = await runtime.transition({ taskId: created.id, ownerId: created.ownerId, from: 'planning', to: 'queued', expectedVersion: 0, correlationId: 'c' })
    const running = await runtime.transition({ taskId: queued.id, ownerId: queued.ownerId, from: 'queued', to: 'running', expectedVersion: 1, correlationId: 'c' })
    const waiting = await runtime.waitForDevice(running, 'c')
    const resumed = await runtime.resume(waiting, 'c')
    await expect(runtime.resume(waiting, 'c')).rejects.toMatchObject({ code: 'CONCURRENT_TRANSITION' })
    expect(resumed.status).toBe('queued')
  })

  it('cancels only through a valid runtime transition', async () => {
    const repository = new FakeRepository()
    const runtime = new TaskRuntime(repository)
    const task = (await runtime.create({ ownerId: 'owner', title: 'Task', idempotencyKey: 'one', correlationId: 'c' })).task
    expect((await runtime.cancel(task, 'c')).status).toBe('cancelled')
  })
})
