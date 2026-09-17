# Pegasus: estado oficial de execução

Atualizado em 2026-09-17.

## Concluído e validado

- fundação da aplicação;
- autenticação e sessões por código e CI, com cerimônia TOTP real ainda pendente para go-live;
- Pegasus Core e AI Router;
- Web/PWA, Chat, multimodalidade e voz conforme checkpoints da Sprint 4;
- provider OpenAI, parser da Responses API, identidade do Pegasus e desambiguação, validados no Preview.
- `MEMORY E2E VALIDATED`, incluindo supersessão e provenance primária;
- `P1 - PERSONAL HOME FOUNDATION VALIDATED`, conforme Human Validation da PR #14.

## Implementado, aguardando validação

- Knowledge Store e adapter Drive somente leitura estão implementados por contrato, mas Google OAuth e documento real permanecem não validados.

## Implementado, aguardando Human Validation

- `P2.1 - CONVERSATION INTELLIGENCE + RESEARCH ROUTING`: Conversation como memória de trabalho, pending interaction estruturado e contexto limitado para o selector;
- continuidade de capability e parâmetros na mesma Conversation entre Chat, Home e Voice, com ruptura explícita em `Nova conversa`;
- Capability Registry e seleção semântica estruturada, com Weather multi-turn e single-turn como primeiro E2E de Live Information;
- provenance, freshness, audit/correlation, provider substituível, falha fechada e exclusão de Live Information da curadoria automática de Memory;
- presença central continua preparada para o asset oficial, que permanece pendente do PO e não bloqueia P2.1.

## Bloqueado deliberadamente

- Google OAuth, Drive real e Calendar até autorização específica;
- P3, Gmail, Calendar, Drive OAuth real, News/Search, Device Agent, filesystem e Meeting Copilot durante este checkpoint;
- embeddings ativos até decisão explícita de modelo, custo, dimensão e política;
- ações consequenciais sem Permission, Policy, Decision Guard, Approval, Execution e Audit.

## Próximo checkpoint

`P2.1 - CONVERSATION INTELLIGENCE + RESEARCH ROUTING READY FOR HUMAN VALIDATION`. Após a publicação do Preview, parar para validação humana antes de qualquer incremento posterior.
