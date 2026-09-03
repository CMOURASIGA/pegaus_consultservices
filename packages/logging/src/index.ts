const secretPattern = /(authorization|cookie|token|password|secret|api[_-]?key|service[_-]?role|recovery[_-]?code)/i

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, secretPattern.test(key) ? '[REDACTED]' : redact(item)]))
  return value
}

function write(level: 'info' | 'warn' | 'error', event: string, data: Record<string, unknown> = {}) {
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...redact(data) as object })
  if (level === 'error') console.error(entry)
  else if (level === 'warn') console.warn(entry)
  else console.info(entry)
}

export const logger = { info: (event: string, data?: Record<string, unknown>) => write('info', event, data), warn: (event: string, data?: Record<string, unknown>) => write('warn', event, data), error: (event: string, data?: Record<string, unknown>) => write('error', event, data) }
