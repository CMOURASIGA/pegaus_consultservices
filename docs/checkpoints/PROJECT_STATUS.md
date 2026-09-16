# Pegasus: estado oficial de execução

Atualizado em 2026-09-16.

## Concluído e validado

- fundação da aplicação;
- autenticação e sessões por código e CI, com cerimônia TOTP real ainda pendente como requisito de go-live;
- Pegasus Core e AI Router;
- Web/PWA, Chat, multimodalidade e voz conforme checkpoints da Sprint 4;
- provider OpenAI, parser da Responses API, identidade do Pegasus e desambiguação, validados no Preview;
- `MEMORY E2E VALIDATED` por Human Validation em 2026-09-16;
- continuidade na mesma conversa, persistência após F5, recuperação entre conversas, memória explícita, ausência sem alucinação, atualização/supersessão e provenance primária validadas;
- cenário final validado: `ProjetoAurora -> ProjetoHorizonte (current)`, com ProjetoAurora como nome anterior, autoria atribuída à mensagem explícita do usuário e timestamp vindo da provenance persistida.

## Implementado, ainda não validado E2E real

- Knowledge Store, chunking, retrieval, provenance e boundary Google Drive somente leitura estão implementados por contrato;
- Google OAuth real, cofre server-side de refresh token e leitura/indexação de documento real permanecem não validados.

## Produto e prioridades

- Pegasus segue cloud-first e multigadget;
- Device Agent/filesystem estão separados do roadmap principal e não bloqueiam a evolução do Pegasus Web;
- Home contextual, briefing, pendências, Attention Engine, notificações e Tasks compõem a próxima evolução de experiência diária;
- integrações externas devem alimentar essa experiência progressivamente, sem transformar uma integração específica em bloqueio artificial para todo o produto quando não houver dependência técnica real.

## Requisitos de go-live / segurança

- cerimônia TOTP real permanece pendente antes de go-live;
- credenciais e refresh tokens de integrações devem permanecer server-side e protegidos;
- ações consequenciais continuam exigindo Permission, Policy, Decision Guard, Approval, Execution e Audit;
- embeddings ativos dependem de decisão explícita de modelo, custo, dimensão e política.

## Próxima decisão de produto

O fechamento de Memory E2E não autoriza automaticamente Drive/OAuth nem outra Sprint.

Antes da próxima implementação, o próximo checkpoint deve ser aprovado pelo PO considerando valor de uso diário e dependências reais. A direção preferencial é iniciar a camada de experiência pessoal do Pegasus Web com um `HOME CONTEXTUAL FOUNDATION`, consumindo inicialmente dados já disponíveis (memória, conversas, contexto e estruturas de Tasks existentes) e deixando Drive, Gmail, Calendar e demais conectores entrarem como fontes incrementais em checkpoints próprios.

A próxima implementação só deve começar após escopo/checkpoint explícito e autorização do proprietário.

## Processo obrigatório de Human Validation

`implementação -> gates técnicos -> Human Validation -> registro no GitHub -> checkpoint fechado -> próxima autorização`

O registro consolidado das validações humanas é mantido na Issue #12 (`Human Validation Ledger`).
