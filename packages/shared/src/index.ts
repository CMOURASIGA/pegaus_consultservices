export type ComponentStatus = 'healthy' | 'degraded' | 'unavailable'
export type HealthComponent = { name: string; status: ComponentStatus; latencyMs?: number }
export type HealthReport = { status: ComponentStatus; version: string; timestamp: string; components: HealthComponent[] }

export class AppError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 500) { super(message); this.name = 'AppError' }
}
