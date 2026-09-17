import type { InteractionRequest, ModelMessage } from './contracts'
import type { AiRouter } from './ai-router'
import type { CapabilitySelection, CapabilitySelectorPort } from './capability-routing'

function parseSelection(content: string): CapabilitySelection {
  const candidate = content.trim().replace(/^```(?:json)?\s*/iu, '').replace(/\s*```$/u, '')
  const value = JSON.parse(candidate) as Record<string, unknown>
  if (value.status === 'none') return { status: 'none' }
  if (value.status === 'needs_input' && typeof value.capabilityId === 'string' && typeof value.message === 'string') return { status: 'needs_input', capabilityId: value.capabilityId, message: value.message.slice(0, 300) }
  if (value.status === 'selected' && typeof value.capabilityId === 'string' && 'input' in value) return { status: 'selected', capabilityId: value.capabilityId, input: value.input }
  throw new Error('INVALID_CAPABILITY_SELECTION')
}

export class ModelCapabilitySelector implements CapabilitySelectorPort {
  constructor(private readonly router: AiRouter, private readonly allowPaidModels: boolean) {}

  async select({ request, capabilities }: Parameters<CapabilitySelectorPort['select']>[0]): Promise<CapabilitySelection> {
    const catalog = capabilities.map(({ id, description, category, inputSchema, readOnly }) => ({ id, description, category, inputSchema, readOnly }))
    const messages: ModelMessage[] = [
      { role: 'system', content: 'Você é o seletor restrito de capabilities do Pegasus. Classifique a intenção semanticamente, sem depender de palavras específicas. Escolha somente um id do catálogo. Nunca execute ações. Responda exclusivamente JSON. Formatos permitidos: {"status":"none"}, {"status":"needs_input","capabilityId":"id","message":"pergunta objetiva"}, {"status":"selected","capabilityId":"id","input":{...}}. Para datas relativas, use current ou tomorrow. Para data explícita, use YYYY-MM-DD. Se a solicitação não precisar de uma capability listada, use none.' },
      { role: 'user', content: `CATÁLOGO:\n${JSON.stringify(catalog)}\n\nSOLICITAÇÃO:\n${request.input.content}` },
    ]
    const selectorRequest: InteractionRequest = { ...request, id: `${request.id}:capability-selection`, requirements: { capability: 'balanced', quality: 'standard', latency: 'low', requiredModalities: ['text'] }, execution: { ...request.execution, allowPaidModels: this.allowPaidModels, maxEstimatedCostUsd: 0.01 } }
    return parseSelection((await this.router.route(selectorRequest, messages)).content)
  }
}
