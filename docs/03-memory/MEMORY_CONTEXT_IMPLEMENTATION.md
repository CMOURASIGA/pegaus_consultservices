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

## Curadoria e continuidade E2E

Ordens explícitas como `lembre que`, `guarde`, `memorize` e `lembre disso` têm prioridade e são persistidas com autoridade `explicit_user`, confiança e relevância máximas. A referência `lembre disso` só é aceita quando existe uma mensagem anterior do próprio owner na conversa. Preferências, relações pessoais estáveis e projetos com sinais determinísticos podem ser registrados como inferidos, com confiança inferior e indicação visível de origem. Conversa comum não vira memória.

Títulos semânticos estáveis, como `relationship:spouse`, `project:7grafica` e `preference:product-development`, permitem detectar duplicidade e atualizar o fato atual sem criar duas verdades ativas. A atualização cria nova versão e nova entrada de origem antes de substituir o estado corrente.

Quando a mensagem declara uma mudança de um projeto já identificado, a chave permanece ligada à identidade do projeto e não ao nome novo. O valor anterior fica somente no versionamento. A fonte da atualização aponta para a mensagem do proprietário. Histórico gerado pelo assistente pode sustentar continuidade conversacional, mas é marcado como `assistant_generated`, com confiança factual zero, e não substitui uma mensagem `user_provided` como provenance.

Conteúdo com sinais ou formatos de credencial é descartado antes da persistência. Essa proteção é adicional e não substitui o Secret Manager.

## Estado e histórico

`memories` mantém o estado corrente. Toda criação gera a versão inicial e cada correção explícita acrescenta uma nova linha em `memory_versions` antes de atualizar o estado corrente. Arquivamento retira a memória do retrieval sem apagar seu histórico.

## Retrieval e Context Budget

O Context Engine consulta somente memórias ativas do proprietário, limita candidatos, calcula ranking por termos, aliases, escopo, relevância, confiança, autoridade e tipo, e aplica limites de itens, tamanho por item e tamanho total. Memórias sem relevância para a solicitação não são enviadas ao Router. O histórico da conversa atual é consultado separadamente, filtrado pelo mesmo owner e conversation ID, e entra somente quando relevante ou quando a fala contém uma referência de continuidade.

Cada item selecionado informa proveniência no formato `memory:<id>:<source-kind>` e metadados de origem, data, atualização, autoridade e confiança. A observabilidade registra apenas correlation ID, contagens, caracteres, fontes agregadas, duração do retrieval, fontes degradadas e truncamento, nunca o conteúdo da memória.

Falha isolada de memória, histórico ou documento degrada aquela fonte sem impedir uma resposta segura. A política do Core instrui o modelo a admitir ausência de informação, não inventar provenance e não afirmar persistência com base apenas no texto do usuário.

Memória recuperada é contexto não executivo. Ela não concede permissão, não altera policy e não autoriza Tools. A resposta do modelo continua `untrusted` e com `executionAuthorization: none`.

## Limites deliberados

- a infraestrutura pgvector, HNSW e `private.match_memories` existe, mas não há embeddings de memória gerados no ambiente atual; a recuperação ativa permanece lexical/relevância até uma escolha explícita de modelo, custo e política de embeddings;
- sem resolução completa de entidades ou referências ambíguas;
- Google Drive real continua dependente de OAuth e cofre server-side, embora o boundary do Knowledge Store já exista;
- sem exclusão física de memória;
- sem automação de consolidação ou deduplicação semântica;
- sem provider de linguagem pago para decidir curadoria.

Essas capacidades permanecem atrás dos contratos atuais para evolução nas Sprints posteriores.
