# P2.1 — Conversation Intelligence + Research Routing

Atualizado em 2026-09-17.

## Status

Human Validation do P2 identificou blocker arquitetural. P2 não deve ser considerado aprovado enquanto este documento não for implementado e validado.

Este addendum complementa `P2_DIGITAL_PRESENCE_AND_CAPABILITY_ROUTING.md`. Não substitui os limites de segurança, Memory, Core, Decision Guard, Audit ou Device Agent já definidos.

## Problema observado em Human Validation

O fluxo Weather funciona em testes isolados, mas a experiência multi-turn não mantém adequadamente a intenção e os parâmetros da conversa. Foram observadas múltiplas conversas criadas durante tentativas do mesmo assunto e loops como:

1. usuário pergunta previsão;
2. Pegasus solicita/recebe localidade;
3. resposta seguinte não reutiliza corretamente intenção/contexto anterior;
4. Capability Selector volta a interpretar somente a mensagem corrente;
5. usuário precisa repetir informações ou entra em loop.

Corrigir apenas parsing/geocoding de uma cidade não resolve o problema de produto.

## Princípio central

A Conversation é a memória de trabalho da interação atual.

Memory é memória persistente de longo prazo e não deve ser usada para compensar perda de Conversation Context.

Separação obrigatória:

- **Conversation Context** — turnos, intenção corrente, referências, parâmetros e continuidade da conversa atual;
- **Pending Interaction State** — capability/intenção pendente, parâmetros conhecidos, parâmetros faltantes e validade;
- **Memory** — fatos/contexto persistentes relevantes sobre o usuário;
- **Knowledge** — documentos/conhecimento persistente;
- **Trusted Session Context** — data, hora, timezone e contexto confiável da sessão;
- **Live Information** — informação externa mutável com provenance/freshness;
- **Model** — compreensão/raciocínio/composição, sem autoridade operacional;
- **Tools/Capabilities** — meios estruturados de consultar ou agir.

## Regra de continuidade da Conversation

Uma conversa deve permanecer a mesma até que o usuário explicitamente inicie `Nova Conversa`, selecione outra conversa existente ou ocorra uma regra explícita de encerramento definida pelo produto.

Navegar entre Home, Chat/Histórico e Voice não deve criar automaticamente uma nova Conversation quando existe uma Conversation ativa a ser continuada.

Texto e Voice devem conseguir continuar o mesmo `conversationId` quando representam a mesma interação.

Não criar uma nova conversa a cada tentativa, follow-up ou preenchimento de parâmetro.

## Capability selection com contexto

O Capability Selector não pode receber somente a última mensagem isolada.

A seleção deve receber um contexto mínimo, sanitizado e limitado, suficiente para continuidade, incluindo quando aplicável:

- mensagem atual;
- turnos recentes relevantes da mesma Conversation;
- resumo/working context da Conversation quando necessário;
- pending intent/capability;
- parâmetros já conhecidos;
- parâmetros faltantes;
- Trusted Session Context necessário para datas relativas;
- catálogo de capabilities disponíveis.

Não enviar indiscriminadamente histórico ilimitado ao seletor. Aplicar limites de tamanho, relevância e trust boundary.

## Pending Interaction State

Quando uma capability retornar `needs_input`, não tratar isso apenas como uma resposta textual descartável.

Persistir/associar à Conversation um estado de interação pendente, conceitualmente:

```text
conversationId
capabilityId
intent
knownParameters
missingParameters
createdAt
updatedAt
expiresAt/status
correlationId
```

Exemplo:

```text
capability: weather.forecast
known: date=tomorrow
missing: location
```

Se o usuário responder `Rio de Janeiro`, o próximo turno deve completar a interação pendente e executar Weather, sem exigir que o usuário repita `previsão do tempo amanhã`.

Após conclusão, cancelamento, mudança clara de assunto ou expiração, o pending state deve ser resolvido/descartado de forma determinística.

Não persistir pending state em Memory.

## Resolução de referências e follow-ups

Casos mínimos que devem funcionar dentro da mesma Conversation:

```text
U: Qual a previsão amanhã?
P: Para qual cidade?
U: Rio de Janeiro.
P: <consulta e responde>
```

```text
U: Qual a previsão amanhã no Rio de Janeiro?
P: <consulta e responde>
U: E sábado?
P: <mantém localidade, resolve data, consulta novamente>
```

```text
U: Como está o tempo em Niterói?
P: <responde>
U: E no Rio de Janeiro?
P: <mantém intenção Weather, troca localidade, consulta>
```

```text
U: Vamos falar de outra coisa. O que você lembra sobre o projeto X?
P: <abandona pending Weather quando houver mudança clara de assunto e segue fluxo normal>
```

## Geocoding/localidade

Weather deve aceitar localidades humanas normais, inclusive cidades com nomes compostos e qualificadores de estado/país.

`Rio de Janeiro`, `Rio de Janeiro, RJ`, `Niterói, Rio de Janeiro`, `Curitiba` e equivalentes válidos não devem exigir formulações artificiais.

Ambiguidade real deve gerar pergunta objetiva. Não rejeitar uma localidade conhecida apenas porque o texto contém artigo/preposição ou variação natural.

Geocoding/provider continua substituível e a falha deve ser explícita, sem alucinação.

## Research / Live Information Routing

Weather permanece primeiro E2E, mas não construir Pegasus como uma coleção de `if` ou APIs especiais desconectadas.

O Core/orquestração deve distinguir, para cada solicitação:

1. há informação suficiente em Conversation/Memory/Knowledge/Trusted Context?
2. a pergunta pode ser respondida de forma confiável sem informação atual externa?
3. falta um parâmetro que deve ser perguntado ao usuário?
4. a solicitação exige informação atual e existe capability adequada?
5. a capability falhou ou não existe? Nesse caso, declarar limitação, não inventar.

Preparar a arquitetura para uma futura capability genérica de pesquisa/Web/Search, sem implementá-la neste checkpoint salvo autorização posterior do PO.

Weather não deve ser tratado como substituto de Web Search, e Web Search não deve substituir providers estruturados quando uma fonte especializada for apropriada.

## Relação com OpenAI/modelo

A presença de `OPENAI_API_KEY` não significa acesso automático à Internet, nem substitui Memory.

O modelo é usado para compreensão/raciocínio/composição e, quando definido, seleção semântica de capabilities. Informação atual deve vir de capability/fonte autorizada quando necessária.

Memory continua necessária para contexto persistente do usuário que não faz parte do conhecimento geral do modelo e que deve sobreviver entre Conversations.

Não assumir que conhecimento paramétrico do modelo é current/live data.

## Conversation History / UI

O Histórico deve representar Conversations reais, não tentativas fragmentadas do mesmo fluxo.

Requisitos:

- `Nova Conversa` cria nova Conversation explicitamente;
- follow-up permanece na Conversation ativa;
- abrir Voice a partir de uma Conversation preserva o id;
- retornar da Voice preserva o id;
- Home pode continuar a Conversation ativa quando aplicável;
- selecionar item no Histórico abre aquela Conversation;
- título pode ser atualizado/derivado sem criar nova Conversation;
- não criar Conversation vazia por simples navegação.

## Context window e custo

Não enviar histórico ilimitado ao modelo.

Implementar estratégia explícita de working context:

- últimos turnos relevantes;
- resumo quando necessário;
- Memory recuperada separadamente;
- Knowledge recuperado separadamente;
- pending state estruturado;
- provenance/trust preservados.

O mecanismo deve permitir evolução posterior para compactação/resumo sem alterar a identidade da Conversation.

## Memory curation

Não gravar automaticamente em Memory:

- previsão meteorológica;
- respostas de provider live;
- parâmetros temporários de pending interaction;
- toda frase de uma conversa apenas para manter contexto.

Memory Curator deve continuar seletivo. O fato de uma informação ter sido necessária durante uma Conversation não implica que ela mereça memória persistente.

## Testes obrigatórios

Além dos testes unitários atuais, adicionar integration/E2E cobrindo o mesmo caminho usado pelo Chat real:

1. pergunta Weather completa em um turno;
2. Weather `needs_input` + resposta do usuário no segundo turno;
3. follow-up `E sábado?` reutilizando localidade;
4. follow-up trocando apenas localidade;
5. mudança clara de assunto cancela/reseta pending intent;
6. mesma Conversation preservada entre todos os follow-ups;
7. `Nova Conversa` cria novo id;
8. Voice e Chat preservam Conversation quando continuando o mesmo fluxo;
9. localidade válida `Rio de Janeiro` resolve normalmente;
10. localidade ambígua pede esclarecimento;
11. provider indisponível falha explicitamente;
12. live information não entra em Memory;
13. contexto enviado ao selector é limitado/sanitizado;
14. nenhuma saída do modelo ou conteúdo externo eleva autoridade;
15. regression de Memory, Knowledge, Voice, TTS, temporal context e Audit.

## Human Validation obrigatória

Antes de declarar READY, validar manualmente no Preview, na mesma Conversation:

```text
Qual é a previsão do tempo amanhã?
Rio de Janeiro.
E sábado?
E em Niterói?
```

O resultado esperado é uma conversa contínua, sem novas Conversations automáticas e sem pedir novamente dados que já estão disponíveis no working context.

Depois selecionar `Nova Conversa` e confirmar que um novo contexto é criado.

Também validar:

```text
Qual é a previsão do tempo amanhã no Rio de Janeiro?
```

em um único turno.

## Fora de escopo

Não avançar neste checkpoint para:

- P3;
- Gmail;
- Calendar;
- Drive OAuth real;
- Web/Search geral;
- News;
- Market;
- Meeting Copilot;
- novas capabilities de Device Agent;
- filesystem/screen/shell;
- mudanças de autoridade/Approval/Decision Guard.

O asset humanoide oficial pode permanecer pendente do PO e não deve ser usado para mascarar ou bloquear esta correção cognitiva.

## Checkpoint

Somente declarar:

`P2.1 — CONVERSATION INTELLIGENCE + RESEARCH ROUTING READY FOR HUMAN VALIDATION`

quando os testes multi-turn e a validação manual acima estiverem disponíveis em Preview.

Parar nesse checkpoint e aguardar Human Validation do PO.