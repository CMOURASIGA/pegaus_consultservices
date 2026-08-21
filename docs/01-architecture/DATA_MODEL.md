# Pegasus Logical Data Model

## Objetivo
Definir as entidades persistentes necessárias ao Pegasus antes da criação de SQL, migrations e índices físicos no Supabase.

## Princípios
- Supabase é o Memory Store e banco operacional estruturado.
- Google Drive permanece como Knowledge Store para documentos extensos.
- Secrets não são persistidos neste modelo.
- O Memory Curator decide retenção e promoção de conteúdo para memória persistente.
- Histórico relevante deve ser preservado em vez de sobrescrito silenciosamente.

## Domínios de dados

### Identity
Entidades previstas: users, trusted_devices, passkey_credentials, sessions, recovery_codes e security_preferences.

Passkey credentials armazenam apenas material público e metadados necessários ao WebAuthn, nunca biometria.

### Conversations
Entidades: conversations, messages e conversation_assets.

Conversas existem durante processamento, mas sua retenção permanente é determinada pelo Memory Curator ou por ordem explícita de Christian. Deve ser possível manter somente resumo/memórias derivadas quando o conteúdo integral não possuir valor futuro.

Metadados incluem canal, contexto, escopo, participantes identificados/prováveis e relação com projetos/assuntos.

### Memory
Entidades: memories, memory_versions, memory_relations e memory_sources.

Campos conceituais incluem tipo, conteúdo, origem, confiança, relevância, escopo, status, datas, última utilização e autoridade da fonte.

Estados devem permitir ativo, superado, corrigido, arquivado ou removido logicamente conforme política.

### Entity Knowledge Graph
Entidades estruturadas: people, organizations, clients, projects, topics e entity_relations.

Objetivo é permitir que Pegasus conheça pessoas, empresas, projetos e assuntos como entidades relacionáveis, não apenas texto solto.

### People
Pessoa pode possuir nome, apelidos, organização, cargo/relação, contatos autorizados, relação com Christian, projetos, assuntos, interações e memórias associadas.

A arquitetura deve suportar futuramente identidade multimodal/probabilística de interlocutores, mantendo sinais e confiança separados da identidade confirmada.

### Speaker Identity
Entidades futuras previstas: speaker_profiles e speaker_observations.

Speaker recognition é probabilístico e não equivale a autenticação. Um match de voz deve armazenar confiança e evidências/contexto. Baixa confiança exige confirmação em vez de afirmação categórica.

Biometria de voz não deve ser implementada na V1 sem revisão específica de privacidade, segurança e consentimento.

### Documents
Entidades: documents, document_versions, document_chunks/indexes e document_relations.

Supabase armazena referência do Drive, metadados, hash/versão, classificação, contexto, status de indexação e relações. Documento original permanece no Knowledge Store sempre que possível.

### Tools and Skills
Entidades: tools, tool_capabilities, skills, skill_versions, skill_tools e permission_policies.

Registrar origem da Skill, versão, status, risco e políticas de aprovação.

### Automations
Entidades: automations, automation_runs, monitors e schedules/triggers.

Registrar objetivo, gatilho, frequência, estado, execução anterior/próxima, resultado, erro e política de notificação.

### Decision and Approval
Entidades: decision_inbox_items, recommendations, approvals e approval_events.

Registrar prioridade, risco, recomendação, ação proposta, estado, decisão humana e resultado posterior.

### Integrations
Entidades: integrations, integration_capabilities, granted_permissions e integration_events.

Não armazenar tokens/secrets. Guardar referência segura ao Secret Manager quando necessária, status, capacidades, permissões, concessão/revogação, saúde e último uso.

### Execution
Entidades: tasks, task_steps, tool_executions e execution_results.

Permitem rastrear tarefas longas, planos, Skills/Tools utilizadas, início/fim, estado, resultado, falha e aprovação relacionada.

### AI Usage
Entidades: ai_requests e ai_usage.

Registrar provedor, modelo, tier, tokens/consumo, custo, latência, motivo da seleção, fallback/escalonamento e tarefa relacionada.

### Audit
Entidade append-oriented audit_events para eventos de autenticação, permissões, memória, Tools, aprovações, Decision Guard, Emergency Lock e configurações.

Logs devem seguir minimização e nunca armazenar secrets.

## Histórico
Mudanças relevantes em memórias, Skills, permissões, configurações e decisões devem preservar versões/eventos anteriores. O estado atual deve ser facilmente consultável sem destruir a evolução histórica.

## Relações
Entidades centrais devem poder relacionar-se sem duplicação excessiva. Exemplo: uma conversa pode relacionar Christian, outra pessoa, um projeto, um cliente, documentos, memórias derivadas e uma decisão.

## Próxima etapa
Este documento é lógico. DATABASE.md detalha diretrizes físicas iniciais. SQL definitivo deve ser criado apenas durante implementação/migrations e revisado contra estas SPECS.
