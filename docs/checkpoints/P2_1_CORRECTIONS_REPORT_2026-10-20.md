# P2.1 — Relatório de correções para revalidação humana

**Repositório:** `CMOURASIGA/pegaus_consultservices`  
**Escopo:** Memória persistente e legibilidade do Histórico  
**Data:** 20/10/2026  
**Status:** Corrections ready for human revalidation

## 1. Causas identificadas

### Memória persistente

A confirmação vocal podia ser produzida pelo modelo independentemente do resultado real da curadoria/persistência. Assim, uma falha de escrita, curadoria ou autorização podia deixar a conversa com uma confirmação que não correspondia a um registro persistido.

A recuperação também dependia de coincidência lexical entre a pergunta e o conteúdo salvo. A pergunta de homologação usa “preferência”, enquanto o conteúdo salvo normalmente contém “prefiro”; essa relação não estava explicitamente coberta pelos aliases do recuperador.

Não foi alterada autenticação, RLS, autorização ou migration. O vínculo ao proprietário continua sendo aplicado pelas operações owner-scoped existentes.

### Histórico no tema escuro

A regra escura era aplicada ao contêiner `.chat-message.assistant`, mas a regra anterior `.chat-message.assistant p` continuava aplicando `background: #fff` ao balão interno. O texto herdava o token claro do tema escuro, causando baixo contraste.

## 2. Correções implementadas

- Pedidos explícitos de memória passaram a ser identificados deterministicamente.
- A confirmação de memória agora é determinística e só diz que guardou após `MemoryCurator.capture` retornar `action: persist`.
- Em falha de curadoria/persistência, o Pegasus informa que não conseguiu confirmar a gravação e não afirma sucesso.
- A separação entre Conversation Working Context e memória persistente foi preservada.
- O recuperador passou a relacionar `preferência`, `preferencias` e `prefiro`.
- O balão interno do assistente no Histórico agora usa `var(--presence-surface-strong)` e `var(--presence-text)` no tema ativo.
- Next.js foi atualizado para 16.4.2; `npm run security:audit` passou sem vulnerabilidades de produção.

## 3. Arquivos alterados

- `apps/web/lib/chat/service.ts`
- `apps/web/lib/chat/service.test.ts`
- `apps/web/app/styles.css`
- `apps/web/app/app/personal-home.test.ts`
- `apps/web/package.json`
- `package-lock.json`
- `packages/core/src/memory.ts`
- `packages/core/src/context-engine.ts`
- `packages/core/src/context-engine.test.ts`

## 4. Validação automatizada no mesmo estado local

| Check | Resultado |
|---|---|
| `npm ci` | PASS |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 34 arquivos, 171 testes |
| `npm run build` | PASS — Next.js 16.4.2 |
| `npm run security:secrets` | PASS — 225 arquivos rastreados |
| `npm run security:audit` | PASS — 0 vulnerabilidades de produção |

## 5. Cenários cobertos pelos novos testes

- Persistência explícita retorna confirmação verdadeira e não chama o modelo para inventar confirmação.
- Falha da curadoria não produz confirmação falsa.
- A preferência “prefiro revisar a especificação técnica antes de autorizar...” é recuperada por pergunta equivalente em nova conversa.
- Balões do assistente possuem tokens explícitos de fundo e texto compatíveis com o tema escuro.

## 6. Revalidação humana pendente

A aprovação final ainda depende dos testes no Preview:

1. Registrar a preferência por voz.
2. Confirmar a presença do item em Memória.
3. Abrir nova conversa e recuperar a preferência.
4. Repetir após logout/login.
5. Abrir Histórico em tema escuro e claro, desktop e mobile.
6. Confirmar que mensagens e dados históricos permanecem intactos.

Este relatório não considera a P2.1 aprovada automaticamente. O SHA remoto final, a branch/PR e a URL do Preview devem ser preenchidos após a publicação e o deployment correspondentes.
