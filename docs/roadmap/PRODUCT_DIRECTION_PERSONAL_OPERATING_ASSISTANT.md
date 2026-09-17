# Pegasus - Direção de Produto: Assistente Pessoal Operacional

Atualizado em 2026-09-17.

## Decisão de produto

Pegasus não deve evoluir para apenas um chatbot com memória. O objetivo é uma única IA pessoal, contextual, proativa e operacional, capaz de apoiar Christian nas atividades pessoais e profissionais em diferentes dispositivos, preservando autoridade humana, privacidade e segurança.

O chat textual permanece disponível, mas não deve ser a ação principal nem definir sozinho a experiência do frontend.

## Experiência principal

A entrada principal deve evoluir do layout centrado em conversa para um Home responsivo do Pegasus, que sintetize o que é relevante agora e permita iniciar interação por voz ou texto.

O Home deve poder reunir progressivamente:

- contexto do dia e briefing;
- compromissos e próximos eventos;
- assuntos que Pegasus está acompanhando;
- pendências e decisões que exigem atenção;
- Tasks e Approvals relevantes;
- notificações e alertas priorizados;
- dispositivos disponíveis e respectivos estados;
- aprendizados/memórias recentes quando fizer sentido expô-los;
- acesso secundário ao histórico de conversas;
- campo de texto para conversar/instruir Pegasus;
- voz como interface de primeira classe.

O campo de texto continua existindo como interface universal e fallback, mas deve ser complementar ao Home, e não necessariamente o elemento dominante da experiência.

## Multigadget e responsividade

Pegasus deve ser concebido para funcionar em qualquer gadget compatível, sem assumir desktop como único formato.

A experiência deve se adaptar a:

- desktop/notebook;
- smartphone/PWA;
- tablet;
- futuros dispositivos/interfaces compatíveis, inclusive experiências predominantemente por voz.

O Core, memória, Tasks, Decision Guard, Approvals e identidade do usuário não podem depender do dispositivo de interface. O frontend é uma projeção responsiva do mesmo Pegasus.

Desktop pode apresentar maior densidade de informação. Mobile deve priorizar contexto imediato, voz, notificações, aprovações e ações rápidas. Nenhum fluxo crítico deve exigir viewport desktop.

## Memória inteligente

Memória não é armazenamento indiscriminado de mensagens.

Fluxo desejado:

`conversa/evento -> identificar informação -> avaliar relevância -> classificar -> consolidar -> relacionar -> recuperar quando útil -> atualizar/superseder quando mudar`

Pegasus deve distinguir, entre outros:

- memória explícita solicitada pelo usuário;
- fatos e contexto candidatos a memória automática;
- projetos;
- pessoas e relacionamentos contextuais;
- preferências;
- decisões;
- compromissos;
- informação temporária;
- informação supersedida;
- informação desconhecida.

Memórias automáticas devem possuir provenance, confiança e política de atualização. Uma informação nova pode corrigir ou superseder uma anterior sem destruir indevidamente o histórico relevante.

Pegasus deve dizer quando não sabe em vez de preencher lacunas por inferência não fundamentada.

## Informação atual e capabilities

Memory e Knowledge não substituem fontes externas atuais. Quando uma solicitação depender de informação ausente ou mutável, Pegasus deve reconhecer essa necessidade e, quando houver capability autorizada, obter a informação de uma fonte apropriada em vez de inventá-la.

A arquitetura deve distinguir Memory, Knowledge, Trusted Session Context, Live Information e Tools/Actions. A seleção de capabilities deve ser genérica e baseada em contratos explícitos, preservando provenance, freshness, audit e os limites de autoridade existentes.

Weather será o primeiro E2E de Live Information. A especificação detalhada está em `docs/roadmap/P2_DIGITAL_PRESENCE_AND_CAPABILITY_ROUTING.md`.

## Proatividade

Pegasus deve progressivamente usar contexto e memória para reduzir trabalho do usuário, e não apenas responder perguntas.

A proatividade poderá incluir briefing, pendências, follow-ups, alertas, decisões aguardando atenção e recomendações contextuais.

Proatividade deve respeitar prioridade, horários silenciosos, relevância, privacidade e possibilidade de silenciar/ajustar comportamento. Proatividade não cria permissão de execução.

## Operação no dispositivo

Acesso operacional a uma máquina ocorre somente quando uma solicitação ou fluxo autorizado realmente exigir uma capability local.

Estar logado no Pegasus ou ter um Device Agent online não concede autorização genérica para observar ou controlar a máquina.

Não realizar monitoramento silencioso contínuo de tela, arquivos, teclado, aplicações ou atividade do usuário.

Toda ação local relevante continua sujeita a identidade do dispositivo, capability, Policy/Decision Guard, Approval quando aplicável, execução estruturada e Audit.

## Device Agent - decisão para A4

O Device Gateway deve permanecer agnóstico ao modo de execução do Agent.

O A4 não deve assumir Windows Service com privilégio administrativo como única opção.

Prever pelo menos:

1. **User Mode / Portable** - prioridade inicial. Executa no contexto do usuário, sem exigir privilégio administrativo quando a política do endpoint permitir. Só possui as permissões que o próprio usuário possui.
2. **Service Mode** - evolução para máquinas autorizadas onde instalação administrativa e execução persistente sejam apropriadas.
3. **Browser Mode** - fallback limitado às capabilities permitidas pelo navegador. Não equivale a controle do sistema operacional.

Em endpoints corporativos que bloqueiem software não homologado por política, Pegasus não deve tentar contornar AppLocker, WDAC, EDR ou controles equivalentes.

O Agent deve permitir ao usuário identificar estado e interromper acesso local, idealmente com experiência simples de tray/app quando o modo suportar.

## Princípio de autoridade

Regra de produto:

> Pegasus observa somente o que foi autorizado, aprende seletivamente o que é relevante e executa somente aquilo para o qual possui autoridade operacional válida.

Texto de conversa, memória, conteúdo recuperado ou saída de modelo nunca substituem autorização técnica.

## Roadmap após Device Agent Local Loop

A3 e A4/A5 continuam necessários para dar capacidade operacional local ao Pegasus, mas não encerram o produto.

Após o primeiro E2E real e a Human Validation do Device Agent Local Loop, priorizar planejamento/execução dos blocos:

1. Memory Intelligence / lifecycle e atualização de memória;
2. Home contextual responsivo e Digital Presence, reduzindo centralidade do chat;
3. Capability Routing e Live Information, começando por Weather;
4. Daily Context / Briefing;
5. Attention Engine e proatividade;
6. Notification Gateway;
7. automações persistentes e acompanhamento de pendências;
8. Meetings / Meeting Copilot;
9. integrações autorizadas com serviços externos;
10. evolução multimodal e awareness sob autorização.

A ordem detalhada desses blocos deve ser reavaliada após o E2E local, mas a direção de produto registrada neste documento não deve ser perdida.

## Critério de produto

O objetivo não é medir sucesso pela quantidade de mensagens que Pegasus consegue responder.

O produto estará se aproximando da visão quando Christian puder abrir ou chamar Pegasus em qualquer gadget e rapidamente entender:

- o que importa agora;
- o que mudou;
- o que está pendente;
- o que Pegasus aprendeu de forma relevante;
- o que precisa de decisão;
- o que Pegasus pode fazer por ele;
- e, quando autorizado, mandar executar uma ação sem precisar operar manualmente cada ferramenta.
