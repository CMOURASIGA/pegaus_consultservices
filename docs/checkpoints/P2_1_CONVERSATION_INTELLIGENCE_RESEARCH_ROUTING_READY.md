# P2.1 - Conversation Intelligence + Research Routing

Atualizado em 2026-09-17.

## Estado

Implementado e aguardando Human Validation.

## Evidência técnica

- Conversation preservada como memória de trabalho e separada de Memory, Knowledge e Live Information;
- `needs_input` persistido como estado estruturado com capability, intenção, parâmetros conhecidos/faltantes, Conversation, validade e correlation;
- selector recebe até seis turnos sanitizados, pending/active capability e Trusted Session Context;
- follow-ups completam ou substituem somente parâmetros relevantes;
- Home, Chat e Voice preservam o `conversationId` ativo;
- `Nova conversa` não cria registro vazio e inicia um novo contexto no primeiro envio;
- Weather permanece efêmero, read-only, com provenance/freshness e fora da curadoria de Memory;
- nenhuma migration, alteração de RLS ou grant;
- P3, Web/Search geral e integrações futuras permanecem bloqueados.

## Human Validation

Na mesma Conversation:

1. `Qual é a previsão do tempo amanhã?`
2. `Rio de Janeiro.`
3. `E sábado?`
4. `E em Niterói?`

Confirmar que localidade, data e capability continuam sem criar novas Conversations. Em seguida selecionar `Nova conversa`, enviar `Qual é a previsão do tempo amanhã no Rio de Janeiro?` e confirmar novo id/contexto e resposta single-turn com fonte e freshness.

## Checkpoint

`P2.1 - CONVERSATION INTELLIGENCE + RESEARCH ROUTING READY FOR HUMAN VALIDATION`
