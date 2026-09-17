import 'server-only'

import type { ContextPort, ContextSnapshot, InteractionRequest } from '@pegasus/core'

const fallbackTimeZone = 'UTC'

export function resolveTimeZone(requested?: string) {
  if (!requested) return fallbackTimeZone
  try {
    return new Intl.DateTimeFormat('pt-BR', { timeZone: requested }).resolvedOptions().timeZone
  } catch {
    return fallbackTimeZone
  }
}

export function applicationTimeContext(context: ContextPort, timeZone: string, now: () => Date = () => new Date()): ContextPort {
  return {
    async assemble(request: InteractionRequest): Promise<ContextSnapshot> {
      const snapshot = await context.assemble(request)
      const current = now()
      const formatted = new Intl.DateTimeFormat('pt-BR', {
        timeZone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'longOffset',
      }).format(current)
      return {
        ...snapshot,
        items: [{
          source: 'application:server-clock',
          classification: 'internal',
          kind: 'trusted_session',
          trust: 'trusted',
          value: `Data e hora atual controlada pela aplicação: ${formatted}. Timezone: ${timeZone}.`,
          provenance: {
            sourceKind: 'application_clock',
            sourceRef: 'server-time',
            recordedAt: current.toISOString(),
            updatedAt: current.toISOString(),
            authority: 'application',
            confidence: 1,
            sourceActorType: 'unknown',
            sourceActorRelationshipToOwner: 'not_applicable',
          },
        }, ...snapshot.items],
      }
    },
  }
}
