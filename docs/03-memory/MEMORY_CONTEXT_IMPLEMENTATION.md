# Memory Curator + Context Engine Implementation

## Escopo da Sprint 5

Esta implementação entrega memória seletiva e contexto mínimo. A integração documental posterior está descrita em `DRIVE_DOCUMENTS_IMPLEMENTATION.md`. O comportamento permanece determinístico e funciona com o provider fake, sem API paga.

## Boundaries

- `packages/core/src/memory.ts`: contratos do repositório, curadoria, classificação de autoridade e bloqueio de secrets.
- `packages/core/src/context-engine.ts`: retrieval, ranking, budget, proveniência e métricas agregadas.
- `apps/web/lib/memory/store.ts`: adapter server-side para `memories`, `memory_versions` e `memory_sources`.
- `/memory`: UX autenticada para revisão, correção e arquivamento.
- `/api/chat`: composição server-side entre Chat, Memory Curator, Context Engine, Core e AI Router.

O Core permanece independente de React, Next.js e Supabase. O adapter utiliza o cliente autenticado do usuário e as policies RLS de ownership existentes. Nenhuma service role é enviada ao browser.

## Curadoria inicial

Ordens explícitas como `lembre que`, `guarde` e `memorize` têm prioridade e são persistidas com autoridade `explicit_user`, confiança e relevância máximas. Preferências e decisões com sinais determinísticos podem ser registradas como inferidas, com confiança inferior e indicação visível de origem. Conversa comum não vira memória.

Conteúdo com sinais ou formatos de credencial é descartado antes da persistência. Essa proteção é adicional e não substitui o Secret Manager.

## Estado e histórico

`memories` mantém o estado corrente. Toda criação gera a versão inicial e cada correção explícita acrescenta uma nova linha em `memory_versions` antes de atualizar o estado corrente. Arquivamento retira a memória do retrieval sem apagar seu histórico.

## Retrieval e Context Budget

O Context Engine consulta somente memórias ativas do proprietário, limita candidatos, calcula ranking por termos, relevância, confiança, autoridade e tipo, e aplica limites de itens, tamanho por item e tamanho total. Memórias sem relevância para a solicitação não são enviadas ao Router.

Cada item selecionado informa proveniência no formato `memory:<id>:<source-kind>`. A observabilidade registra apenas correlation ID, contagens, caracteres, fontes agregadas e truncamento, nunca o conteúdo da memória.

Memória recuperada é contexto não executivo. Ela não concede permissão, não altera policy e não autoriza Tools. A resposta do modelo continua `untrusted` e com `executionAuthorization: none`.

## Limites deliberados

- sem similaridade vetorial ou embeddings;
- sem resolução completa de entidades ou referências ambíguas;
- Google Drive real continua dependente de OAuth e cofre server-side, embora o boundary do Knowledge Store já exista;
- sem exclusão física de memória;
- sem automação de consolidação ou deduplicação semântica;
- sem provider de linguagem pago para decidir curadoria.

Essas capacidades permanecem atrás dos contratos atuais para evolução nas Sprints posteriores.
