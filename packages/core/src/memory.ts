import type { InteractionRequest } from './contracts'

export type MemoryType = 'episodic' | 'semantic' | 'decision' | 'working_profile' | 'project' | 'relationship'
export type MemoryStatus = 'active' | 'superseded' | 'corrected' | 'archived' | 'deleted'
export type MemoryAuthority = 'explicit_user' | 'inferred'

export type MemoryRecord = {
  id: string
  ownerId: string
  type: MemoryType
  title?: string
  content: string
  scope: string
  status: MemoryStatus
  confidence: number
  relevance: number
  authority: MemoryAuthority
  source: { kind: string; ref?: string }
  createdAt: string
  updatedAt: string
  lastUsedAt?: string
}

export type NewMemory = Omit<MemoryRecord, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'lastUsedAt'>

export interface MemoryRepository {
  create(memory: NewMemory): Promise<MemoryRecord>
  listActive(ownerId: string, limit: number): Promise<readonly MemoryRecord[]>
  correct(input: { ownerId: string; memoryId: string; content: string; reason: string }): Promise<MemoryRecord>
  archive(ownerId: string, memoryId: string): Promise<void>
  markUsed?(ownerId: string, memoryIds: readonly string[]): Promise<void>
}

export type CurationInput = {
  ownerId: string
  content: string
  source: { kind: 'conversation' | 'user_action'; ref?: string }
  scope?: string
}

export type CurationDecision =
  | { action: 'discard'; reason: 'irrelevant' | 'sensitive' | 'empty' }
  | { action: 'persist'; memory: NewMemory }

const explicitMemory = /^(?:por favor,?\s*)?(?:lembre(?:-se)?|guarde|memorize)(?:\s+disso)?(?:\s+de)?(?:\s+que)?[\s,:-]+(.+)$/iu
const reusableSignal = /\b(?:eu prefiro|minha preferência|eu decidi|a decisão é|sempre use|nunca use|meu projeto|meu cliente)\b/iu
const secretSignal = /\b(?:password|senha|secret|token|api[_ -]?key|service[_ -]?role|private[_ -]?key)\b\s*[:=]\s*\S+/iu
const credentialShape = /\b(?:sk-[a-z0-9_-]{16,}|eyJ[a-z0-9_-]{20,}\.[a-z0-9_-]{10,}|[a-f0-9]{32,})\b/iu

export function containsSecret(content: string) {
  return secretSignal.test(content) || credentialShape.test(content)
}

function inferType(content: string): MemoryType {
  if (/\b(?:prefiro|preferência|sempre use|nunca use)\b/iu.test(content)) return 'working_profile'
  if (/\b(?:decidi|decisão)\b/iu.test(content)) return 'decision'
  if (/\b(?:projeto|sprint|cliente)\b/iu.test(content)) return 'project'
  if (/\b(?:pessoa|equipe|empresa|organização)\b/iu.test(content)) return 'relationship'
  return 'semantic'
}

export class MemoryCurator {
  constructor(private readonly repository: MemoryRepository) {}

  evaluate(input: CurationInput): CurationDecision {
    const content = input.content.replace(/\s+/g, ' ').trim()
    if (!content) return { action: 'discard', reason: 'empty' }
    if (containsSecret(content)) return { action: 'discard', reason: 'sensitive' }
    const explicit = content.match(explicitMemory)?.[1]?.trim()
    const inferred = reusableSignal.test(content)
    if (!explicit && !inferred) return { action: 'discard', reason: 'irrelevant' }
    const value = explicit ?? content
    const authority: MemoryAuthority = explicit ? 'explicit_user' : 'inferred'
    return {
      action: 'persist',
      memory: {
        ownerId: input.ownerId,
        type: inferType(value),
        content: value,
        scope: input.scope ?? 'general',
        confidence: explicit ? 1 : 0.65,
        relevance: explicit ? 1 : 0.7,
        authority,
        source: input.source,
      },
    }
  }

  async capture(input: CurationInput) {
    const decision = this.evaluate(input)
    if (decision.action === 'discard') return decision
    const memory = await this.repository.create(decision.memory)
    return { action: 'persist' as const, memory }
  }

  async correct(input: { ownerId: string; memoryId: string; content: string; reason?: string }) {
    const content = input.content.replace(/\s+/g, ' ').trim()
    if (!content || containsSecret(content)) throw new MemoryPolicyError('memory_content_rejected')
    return this.repository.correct({ ...input, content, reason: input.reason?.trim() || 'Correção explícita do usuário' })
  }
}

export class MemoryPolicyError extends Error {
  constructor(public readonly code: 'memory_content_rejected') { super(code); this.name = 'MemoryPolicyError' }
}

export function memoryQuery(request: InteractionRequest) {
  return request.input.content.replace(explicitMemory, '$1').trim()
}
