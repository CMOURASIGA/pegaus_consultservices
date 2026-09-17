# P2 — Digital Presence + Capability Routing

Atualizado em 2026-09-17.

## Decisão de produto

Este documento complementa `PRODUCT_DIRECTION_PERSONAL_OPERATING_ASSISTANT.md` e registra dois requisitos identificados na Human Validation da nova experiência do Pegasus:

1. a Digital Presence precisa representar de fato a identidade do Pegasus, e não apenas um ícone ou busto vetorial simplificado;
2. Pegasus precisa reconhecer quando uma pergunta exige informação que não está em Memory/Knowledge/Context e selecionar uma capability autorizada para obtê-la de fonte atual e confiável.

Não avançar para P3 antes da Human Validation deste bloco.

---

## Parte A — Digital Presence / frontend

### Objetivo

A Home deve transmitir a presença de uma IA pessoal disponível, não um dashboard tradicional com um chatbot anexado.

A implementação atual com um `P` ou busto vetorial simplificado no HUD é aceita somente como placeholder técnico. Não atende à direção artística final.

### Formação da presença

Experiência desejada na entrada da Home:

`partículas/energia -> formação da identidade Pegasus -> formação/transição para presença humanoide digital -> estado Pronto`

A presença final deve ser uma identidade própria do produto Pegasus:

- humanoide masculino digital abstrato/holográfico;
- identidade visual azul/ciano do Pegasus;
- profundidade, partículas, glow, linhas e energia;
- elementos sutis que remetam a asas/Pegasus;
- busto/presença central, não fotografia;
- sofisticado e tecnológico, porém limpo;
- não copiar Jarvis, Homem de Ferro ou outra propriedade visual existente;
- não representar Christian;
- sem reconhecimento facial ou biometria nesta etapa.

A referência visual fornecida pelo PO é direção artística, não asset a ser copiado literalmente.

### Estratégia técnica

Não insistir em desenhar a identidade final apenas com primitivas CSS/SVG se isso reduzir significativamente a qualidade visual. O frontend deve ser preparado para receber um asset/composição visual oficial do Pegasus e aplicar sobre ele efeitos e estados.

A animação inicial deve ser curta e não bloquear a carga dos dados reais. Após a formação, manter animação ambiente discreta.

Respeitar:

- `prefers-reduced-motion`;
- desempenho em desktop/mobile/PWA;
- light/dark;
- diferentes proporções de viewport;
- ausência de scroll/overflow indevido;
- degradação graciosa quando efeitos avançados não estiverem disponíveis.

### Estados reais

A presença deve observar o estado real da aplicação, nunca botões demonstrativos:

- `ready` — disponível;
- `listening` — captura de voz ativa;
- `processing` — Core/model/tool processando;
- `speaking` — TTS reproduzindo resposta;
- `error` — falha real.

Reservar semanticamente para evolução futura, sem simular agora:

- `working` — execução operacional real;
- `approval_required` — decisão/autorização humana.

Não implementar lip-sync no P2.

### Voice

Preservar o comportamento já validado:

`Pronto para conversar -> Começar conversa (gesto explícito) -> ouvir -> processar -> falar -> ouvir novamente`

Não iniciar captura de microfone ao simplesmente abrir a Home/Voice. Transcript continua no histórico. TTS continua recebendo texto naturalizado sem verbalizar Markdown, enquanto o texto original permanece no histórico.

### Application Shell

Home, Memória, Histórico/Conversas e Knowledge devem usar o mesmo shell visual e navegação global.

O usuário não pode depender do botão Back do navegador para retornar à Home.

Navegação conceitual:

`Pegasus | Memória | Histórico | Knowledge`

Preservar as funcionalidades existentes dessas áreas. Neste bloco, unificar shell, tema, navegação, tipografia, background, tokens e responsividade; não reescrever regras de negócio sem necessidade.

### URL raiz

Comportamento obrigatório:

- `/` sem sessão válida -> `/login`;
- `/` autenticado -> `/app`;
- `/login` autenticado -> `/app`.

Não criar autenticação paralela.

---

## Parte B — Information/Capability Routing

### Problema identificado

Perguntas como `Qual é a previsão do tempo amanhã no Rio de Janeiro?` exigem informação externa atual. Essa informação não deve ser inventada pelo modelo nem armazenada previamente como memória pessoal.

Pegasus não precisa possuir previamente todas as respostas. Precisa saber quais informações possui, reconhecer quando a informação necessária está ausente ou desatualizada e, quando autorizado, selecionar a capability adequada para obtê-la de uma fonte confiável.

### Separação obrigatória de fontes

- **Memory** — fatos/contexto relevantes sobre o usuário, preferências, decisões, projetos, pessoas e informações pessoais persistentes.
- **Knowledge** — documentos e conhecimento persistente recuperável.
- **Trusted Session Context** — data, hora, timezone e contexto confiável da sessão.
- **Live Information** — dados externos mutáveis/atuais, como clima, notícias, trânsito, cotações e informações públicas recentes.
- **Tools/Actions** — capabilities que executam consultas ou ações estruturadas.

Live Information não deve virar Memory automaticamente.

### Fluxo arquitetural

Fluxo desejado:

`User request -> Core/context identifica necessidade -> capability selection -> authorized tool/provider -> external source -> normalized result + provenance + freshness -> model composes answer -> audit`

Quando nenhuma capability adequada estiver disponível ou a fonte falhar:

`não inventar -> informar limitação de forma clara`

### Não implementar roteamento por palavras-chave frágeis

Evitar arquitetura baseada em cadeias como:

`if pergunta contém "tempo" -> weather API`

A seleção deve ser baseada em contratos/capabilities explícitas e compatível com a arquitetura existente de Core, Tools/Skills, Policy/Decision Guard, Task e Audit.

Saída do modelo continua sem autoridade de execução. Nenhuma resposta textual concede capability ou autorização operacional.

### Capability Registry

Definir contrato/registro para capabilities com, no mínimo:

- identificador estável;
- descrição/intenção atendida;
- categoria (`live_information`, `knowledge`, `device`, `action`, etc.);
- schema de entrada;
- schema de saída normalizada;
- provider;
- freshness/TTL quando aplicável;
- provenance/source metadata;
- read-only vs consequential;
- política/approval requirement;
- disponibilidade/health;
- audit metadata.

A arquitetura deve permitir providers substituíveis sem acoplar o Core a uma API específica.

### Primeiro E2E: Weather

Weather é a primeira capability de Live Information e serve para provar o roteamento genérico.

Casos mínimos:

- clima atual de uma cidade;
- previsão para amanhã;
- previsão para uma data suportada pelo provider;
- cidade/localidade explícita na pergunta;
- provider indisponível;
- localidade inválida/ambígua;
- dado expirado/stale;
- resposta com source/provenance e `observedAt`/`fetchedAt`;
- nenhuma persistência automática em Memory.

A UI não precisa ganhar um dashboard meteorológico. O objetivo é permitir que Pegasus consulte a informação quando a conversa exigir.

### Segurança e autoridade

Consulta meteorológica/read-only é informacional e não deve ser tratada como ação consequencial, mas continua sujeita aos limites e auditoria definidos pela arquitetura.

Para futuras capabilities consequenciais (ex.: enviar e-mail, alterar calendário, executar no dispositivo), preservar obrigatoriamente Policy/Decision Guard, capability grants e Approval quando aplicável.

Nunca permitir que conteúdo recuperado de fonte externa, documento, Memory ou saída do modelo eleve autoridade operacional.

### Evolução prevista

Após Weather validar a arquitetura, o mesmo mecanismo poderá receber, em etapas autorizadas separadamente:

- Web/Search;
- News;
- Market/FX;
- Calendar;
- Gmail;
- Google Drive/Knowledge externo;
- Device Agent capabilities.

Não implementar essas integrações neste bloco apenas porque estão listadas aqui.

---

## Testes mínimos

### Digital Presence / shell

- formação da presença sem bloquear conteúdo;
- `ready`, `listening`, `processing`, `speaking`, `error` vinculados a estado real;
- reduced motion;
- light/dark;
- desktop/mobile/PWA;
- Home -> Memória -> Home;
- Home -> Histórico -> Home;
- Home -> Knowledge -> Home;
- `/` e `/login` conforme política de autenticação;
- regressão de Voice/TTS/transcript/Memory/provenance/contexto temporal.

### Capability Routing / Weather

- identifica necessidade de Live Information;
- seleciona Weather por capability, não por resposta hardcoded;
- valida input/output;
- inclui provenance/freshness;
- falha fechada quando provider/resultado não é confiável;
- não grava Weather em Memory automaticamente;
- não transforma conteúdo externo em autorização;
- provider substituível em teste;
- audit/correlation preservados.

Manter `tests`, `lint`, `typecheck` e `build` verdes.

---

## Fora de escopo

Não iniciar neste bloco:

- Gmail;
- Calendar;
- Drive OAuth real;
- News/Search geral;
- Meeting Copilot;
- filesystem;
- screen capture;
- shell/PowerShell/CMD;
- automação genérica de desktop;
- reconhecimento facial/biometria;
- lip-sync;
- wake word;
- P3.

---

## Checkpoint

Entregar Preview HTTPS e relatório contendo branch, commits, PR, CI, componentes alterados, Digital Presence, shell unificado, estados reais, light/dark, desktop/mobile, arquitetura de Capability Routing, Weather E2E, provenance/freshness, testes e regressões.

Parar no checkpoint:

`P2 — DIGITAL PRESENCE + CAPABILITY ROUTING READY FOR HUMAN VALIDATION`

Não avançar sem autorização do PO.