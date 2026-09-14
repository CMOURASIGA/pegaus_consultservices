# Pegasus: estado oficial de execução

Atualizado em 2026-09-14.

## Referências de branch
- documentação e especificações: `docs/infrastructure-specs`;
- implementação corrente: `develop`;
- último commit de implementação verificado: `9d408ac9` - `fix(chat): unify viewport and composer workspace`;
- `main` não deve ser usada como referência do estado funcional corrente enquanto não houver promoção formal.

## Concluído e validado
- Sprint 1 - Foundation e infraestrutura;
- Sprint 2 - autenticação e sessões por código/CI, preservando cerimônia TOTP real como pendência de go-live;
- Sprint 3 - Pegasus Core e AI Router;
- Sprint 4 - Web/PWA, Chat, multimodalidade e voz;
- provider OpenAI, parser da Responses API, identidade Pegasus e desambiguação;
- Sprint 5 - Context + Memory: validação humana aprovada para memória explícita, negative retrieval, recuperação contextual de projeto -> decisão -> preferência e comportamento consultivo contextual.

## Implementado tecnicamente
### Sprint 6 - Knowledge Store / Drive
Implementação técnica existente:
- contrato independente de fonte documental;
- adapter fake determinístico;
- adapter Google Drive somente leitura;
- persistência no schema existente;
- versionamento/hash;
- chunking;
- retrieval lexical;
- integração ao Context Engine;
- proveniência;
- tratamento de conteúdo externo como não confiável;
- bloqueio de secrets;
- área autenticada `/knowledge`.

Permanece pendente o E2E real do Google Drive:
- OAuth;
- cofre server-side para refresh token;
- autorização de fonte real de teste;
- leitura/indexação/retrieval/revogação reais.

Esta pendência não bloqueia a próxima prioridade local, desde que nenhuma implementação finja disponibilidade do Drive real.

## Chat UX
O ajuste de viewport/composer solicitado foi entregue em `develop` no commit `9d408ac9`.

Preservar como critérios de regressão:
- composer integrado ao workspace;
- rolagem independente das mensagens;
- crescimento controlado do textarea;
- auto-follow apenas quando o usuário está próximo ao final da conversa;
- desktop e mobile sem deslocamento indevido do composer.

## Decisão de roadmap em 2026-09-14
A Sprint 7 de integrações externas, Gmail, Calendar e GitHub, fica **adiada deliberadamente**.

Motivo de produto: integrações podem ser adicionadas posteriormente e não são necessárias para validar agora a capacidade central do Pegasus de manter Tasks, aplicar segurança e atuar em uma máquina explicitamente autorizada.

Isso é uma mudança de **ordem**, não uma retirada do escopo V1.

## Próxima prioridade
Avançar para a trilha originalmente coberta pelas Sprints 8 e 9, quebrada em incrementos seguros:

1. Tasks persistentes e lifecycle;
2. Decision Guard e Approval boundary;
3. Device Gateway;
4. pareamento e revogação de dispositivo;
5. heartbeat/status;
6. `WAITING_DEVICE` e retomada idempotente;
7. Device Agent Windows mínimo;
8. capabilities locais granulares;
9. filesystem restrito a diretórios autorizados;
10. command runner controlado;
11. Screen Context sob comando;
12. auditoria ponta a ponta;
13. Meeting Copilot após o fluxo básico de Device Agent estar validado.

## Dependências obrigatórias
A postergação das integrações não autoriza pular controles de segurança.

Antes de uma ação local consequencial, o fluxo deve possuir no mínimo:
`request -> Task -> policy/Decision Guard -> approval quando exigida -> capability -> Device Gateway -> Device Agent -> execução -> resultado -> audit`.

O Device Agent deve falhar fechado quando não puder validar autorização/policy.

Nenhum recurso deve permitir:
- shell/root/admin autônomo;
- controle irrestrito do sistema operacional;
- filesystem fora de diretórios autorizados;
- captura silenciosa/contínua de tela;
- expansão automática de capabilities;
- execução sem trilha de auditoria.

## Primeiro checkpoint funcional desejado
`DEVICE AGENT LOCAL LOOP READY`

Critério demonstrável:
`Login Pegasus -> máquina pareada -> Agent online -> Christian solicita ação -> Decision Guard avalia -> aprovação/capability é verificada -> ação local restrita é executada -> resultado volta à conversa/Task -> auditoria registra a execução`.

Esse checkpoint deve ser alcançado antes de ampliar o Agent para automação mais abrangente.

## Pendências preservadas
- cerimônia TOTP real antes do go-live;
- validação E2E real do Google Drive;
- integrações Gmail, Calendar e GitHub adiadas, não canceladas;
- hardening, backup/restore, Emergency Lock e produção continuam obrigatórios antes da V1 real.

## Próxima ação do desenvolvedor
Não iniciar integração externa.

Primeiro produzir um levantamento técnico do estado atual de:
- Tasks;
- Decision Guard;
- approvals;
- Device Gateway;
- Device Agent;
- migrations relacionadas;
- contratos existentes que possam ser reutilizados.

Depois propor o menor incremento que entregue o primeiro fluxo seguro de Task + dispositivo sem conceder autonomia irrestrita.
