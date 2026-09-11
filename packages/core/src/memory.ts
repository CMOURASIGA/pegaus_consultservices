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

export type MemoryVersionRecord = {
  versionNo: number
  content: string
  reason?: string
  createdAt: string
}

export interface MemoryRepository {
  create(memory: NewMemory): Promise<MemoryRecord>
  listActive(ownerId: string, limit: number): Promise<readonly MemoryRecord[]>
  findActiveByTitle?(ownerId: string, title: string): Promise<MemoryRecord | null>
  listVersions?(ownerId: string, memoryId: string, limit: number): Promise<readonly MemoryVersionRecord[]>
  correct(input: { ownerId: string; memoryId: string; content: string; reason: string; source?: { kind: string; ref?: string } }): Promise<MemoryRecord>
  archive(ownerId: string, memoryId: string): Promise<void>
  markUsed?(ownerId: string, memoryIds: readonly string[]): Promise<void>
}

export type CurationInput = {
  ownerId: string
  content: string
  source: { kind: 'conversation' | 'user_action'; ref?: string }
  scope?: string
  referenceContent?: string
}

export type CurationDecision =
  | { action: 'discard'; reason: 'irrelevant' | 'sensitive' | 'empty' | 'duplicate' }
  | { action: 'persist'; memory: NewMemory }

const explicitMemory = /^(?:(?:pegasus)[,!:]?\s*)?(?:por favor,?\s*)?(?:(?:quero que você\s+(?:se\s+)?lembre)|lembre(?:-se)?|guarde|memorize|registre)(?:\s+disso)?(?:\s+de)?(?:\s+que)?[\s,:-]+(.+)$/iu
const reusableSignal = /\b(?:eu prefiro|minha preferência|quero que você|eu decidi|a decisão é|sempre use|nunca use|meu projeto|meu cliente|estou (?:desenvolvendo|criando)|(?:o|meu) projeto(?: fictício)? (?:agora )?se chama|essa informação mudou|(?:esposa|marido|filho|filha|sócio|sócia) (?:se chama|é)|trabalho (?:na|no)|meu objetivo)/iu
const secretSignal = /\b(?:password|senha|secret|token|api[_ -]?key|service[_ -]?role|private[_ -]?key)\b\s*[:=]\s*\S+/iu
const credentialShape = /\b(?:sk-[a-z0-9_-]{16,}|eyJ[a-z0-9_-]{20,}\.[a-z0-9_-]{10,}|[a-f0-9]{32,})\b/iu
const sensitiveImplicit = /\b(?:cpf|rg|passaporte|cartão de crédito|conta bancária|diagnóstico|prontuário)\b/iu

export function containsSecret(content: string) {
  return secretSignal.test(content) || credentialShape.test(content)
}

export function isDeicticMemoryRequest(content: string) {
  return /^(?:(?:pegasus)[,!:]?\s*)?(?:por favor,?\s*)?(?:lembre(?:-se)?|guarde|memorize|registre)\s+(?:disso|isto|essa informação)(?:\s+para mim)?[.!]?$/iu.test(content.trim())
}

function inferType(content: string): MemoryType {
  if (/\b(?:prefiro|preferência|quero que você|sempre use|nunca use)/iu.test(content)) return 'working_profile'
  if (/\b(?:decidi|decisão)\b/iu.test(content)) return 'decision'
  if (/\b(?:projeto|sistema|sprint|cliente)\b/iu.test(content)) return 'project'
  if (/\b(?:pessoa|equipe|empresa|organização|esposa|marido|filho|filha|sócio|sócia)\b/iu.test(content)) return 'relationship'
  return 'semantic'
}

function slug(value: string) {
  return value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function memoryTitle(content: string, type: MemoryType) {
  if (/\b(?:minha\s+)?esposa\b/iu.test(content)) return 'relationship:spouse'
  if (/\b(?:meu\s+)?marido\b/iu.test(content)) return 'relationship:husband'
  if (/\b(?:o|meu) projeto fictício\b/iu.test(content)) return 'project:fictional-project'
  const project = content.match(/\b(?:sistema|projeto)\s+(?:chamado|denominado)\s+([\p{L}\p{N}_-]+)/iu)?.[1]
  if (project) return `project:${slug(project)}`
  if (type === 'working_profile' && /\b(?:desenvolv|arquitetura|sistemas?|código|especifica)/iu.test(content)) return 'preference:product-development'
  if (type === 'working_profile') return `preference:${slug(content).slice(0, 80)}`
  if (type === 'decision') return `decision:${slug(content).slice(0, 80)}`
  return undefined
}

function inferScope(content: string, type: MemoryType, requested?: string) {
  if (requested) return requested
  if (type === 'project') return 'professional'
  if (type === 'relationship') return 'personal'
  if (/\b(?:trabalho|profissional|projeto|sistema|arquitetura|código|desenvolv)/iu.test(content)) return 'professional'
  return 'general'
}

export class MemoryCurator {
  constructor(private readonly repository: MemoryRepository) {}

  evaluate(input: CurationInput): CurationDecision {
    const content = input.content.replace(/\s+/g, ' ').trim()
    if (!content) return { action: 'discard', reason: 'empty' }
    if (containsSecret(content)) return { action: 'discard', reason: 'sensitive' }
    const explicit = isDeicticMemoryRequest(content) ? input.referenceContent?.replace(/\s+/g, ' ').trim() : content.match(explicitMemory)?.[1]?.trim()
    const inferred = reusableSignal.test(content)
    if (!explicit && !inferred) return { action: 'discard', reason: 'irrelevant' }
    const value = explicit ?? content
    if (!explicit && sensitiveImplicit.test(value)) return { action: 'discard', reason: 'sensitive' }
    const authority: MemoryAuthority = explicit ? 'explicit_user' : 'inferred'
    const type = inferType(value)
    return {
      action: 'persist',
      memory: {
        ownerId: input.ownerId,
        type,
        title: memoryTitle(value, type),
        content: value,
        scope: inferScope(value, type, input.scope),
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
    const title = decision.memory.title
    if (title && this.repository.findActiveByTitle) {
      const current = await this.repository.findActiveByTitle(input.ownerId, title)
      if (current?.content === decision.memory.content) return { action: 'discard' as const, reason: 'duplicate' as const }
      if (current) {
        const memory = await this.repository.correct({ ownerId: input.ownerId, memoryId: current.id, content: decision.memory.content, reason: `Atualização por ${input.source.kind}${input.source.ref ? `:${input.source.ref}` : ''}`, source: input.source })
        return { action: 'persist' as const, memory, operation: 'updated' as const }
      }
    }
    const memory = await this.repository.create(decision.memory)
    return { action: 'persist' as const, memory, operation: 'created' as const }
  }

  async correct(input: { ownerId: string; memoryId: string; content: string; reason?: string }) {
    const content = input.content.replace(/\s+/g, ' ').trim()
    if (!content || containsSecret(content)) throw new MemoryPolicyError('memory_content_rejected')
    return this.repository.correct({ ...input, content, reason: input.reason?.trim() || 'Correção explícita do usuário', source: { kind: 'user_action', ref: 'memory-ui' } })
  }
}

export class MemoryPolicyError extends Error {
  constructor(public readonly code: 'memory_content_rejected') { super(code); this.name = 'MemoryPolicyError' }
}

export function memoryQuery(request: InteractionRequest) {
  return request.input.content.replace(explicitMemory, '$1').trim()
}
