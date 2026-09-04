# Execution Subcheckpoint 4A - WEB/PWA + CHAT READY

## Unidade concluída

Sprint 4A: shell Web/PWA autenticado e primeiro fluxo vertical de Chat conectado ao Pegasus Core e AI Router.

## Origem

- branch: `develop`;
- checkpoint anterior: `PEGASUS CORE + AI ROUTER READY`;
- commit de origem: `55ca8b82e868f9153468c03e53a48a8815a1019a`;
- Issue: #5, mantida aberta para 4B e 4C;
- CI de origem: verde.

As Sprints 1, 2 e 3 não foram refeitas.

## Funcionalidades

- shell autenticado de conversa em `/app`;
- layout desktop com sidebar e layout mobile com drawer;
- nova conversa, histórico recente, retomada por conversation ID e listagem de mensagens;
- composer com Enter para envio e Shift + Enter para quebra de linha;
- estados ready, processing, error e cancelled;
- cancelamento por `AbortController`;
- retry explícito após falha, sem fallback pago automático;
- fluxo `Web -> Route Handler -> ChatService -> PegasusCore -> AiRouter -> FakeAiProvider`;
- provider fake server-side, determinístico, sem API key e custo zero;
- persistência em `conversations` e `messages` usando a sessão Supabase do usuário;
- RLS por owner preservada e filtro explícito por `owner_id` na aplicação;
- IDs de conversa, mensagem e correlação;
- provider/model registrados somente na mensagem do assistente;
- output do modelo marcado como `untrusted` e sem autorização de execução;
- erros de autenticação, validação, provider, timeout e cancelamento sanitizados;
- logs limitados a metadata operacional;
- manifest PWA iniciado em `/app` e modo standalone;
- service worker impedido de cachear chat, API, sessão, autenticação e segurança;
- responsividade com `100dvh`, safe areas, touch targets e landscape compacto;
- labels, foco visível, live region, busy state e reduced motion.

## Persistência e Supabase

O schema existente de `conversations` e `messages` atende a unidade. Nenhuma migration foi criada. O bucket `pegasus-private` permanece privado e será usado somente na 4B, após validação de arquivos e owner.

O projeto Supabase permaneceu `ACTIVE_HEALTHY`, no plano atual e sem alterações de schema, dados, usuários ou políticas.

## Testes e quality gates

- `npm ci --include=dev`: aprovado;
- `npm run lint`: aprovado, zero warnings;
- `npm run typecheck`: aprovado;
- `npm test`: 40 testes aprovados em 13 arquivos;
- `npm run build`: aprovado;
- criação e continuação de conversa: aprovadas;
- persistência de mensagem do usuário e resposta fake: aprovada;
- isolamento por owner: aprovado;
- payload inválido e JSON malformado: aprovados;
- provider failure, timeout e cancellation: aprovados;
- PWA/manifest e exclusão de caches sensíveis: aprovados;
- regras críticas de mobile, teclado virtual, safe area e acessibilidade: verificadas estruturalmente;
- `npm audit --omit=dev`: 0 vulnerabilidades;
- secret scan: aprovado;
- standalone smoke, proteção de `/app`, login, healthcheck e manifest: aprovados no CI;
- CI verde: https://github.com/CMOURASIGA/pegaus_consultservices/actions/runs/33878030298.

## Commits

- implementação publicada: `fc67f2a814cae0b76b4a05c04a85228fba30c189`;
- correção do lockfile integral: `a45f94f2a696de00e5966e8978872e4ad8dc766b`;
- commit deste checkpoint: registrado no histórico após a publicação deste documento.

## Incidente de CI resolvido

O primeiro envio truncou `package-lock.json` durante a transferência pelo conector. O arquivo foi reenviado em blocos, seu Git blob SHA foi comparado com o arquivo local e o CI seguinte passou. Não houve alteração funcional nem force push.

## Segurança e custos

- nenhuma service role ou API key no cliente;
- nenhuma credencial real em teste, fixture, log ou documento;
- nenhuma autorização por `user_metadata`;
- nenhum conteúdo de mensagem em logs de roteamento;
- nenhum provider pago, upgrade, deploy ou infraestrutura adicional;
- nenhuma resposta de IA pode executar Tools ou autorizar ação.

## Validações externas pendentes

- fluxo real `login -> /app -> conversa -> mensagem -> resposta fake` requer sessão autorizada e não foi executado pelo agente;
- inspeção visual manual em navegador desktop, tablet e smartphone não foi executada por indisponibilidade de navegador acessível neste executor;
- instalação real da PWA em smartphone depende de domínio/HTTPS e ambiente implantado;
- cerimônia real de login e enrollment/challenge/verify TOTP continua obrigatória antes do go-live.

Esses pontos não foram marcados como sucesso e não bloqueiam a implementação das subunidades seguintes.

## Estado da Issue

A Issue #5 permanece aberta. A Sprint 4 só será encerrada após:

- 4B - MULTIMODAL INPUT READY;
- 4C - VOICE INTERACTION READY;
- checkpoint final `WEB/PWA + CHAT + MULTIMODAL + VOICE READY`.

## Próxima atividade exata

Sprint 4B: implementar upload validado de imagem/documento, referência privada no Storage, owner isolation, classificação e boundary multimodal sem enviar conteúdo bruto arbitrariamente ao modelo.
