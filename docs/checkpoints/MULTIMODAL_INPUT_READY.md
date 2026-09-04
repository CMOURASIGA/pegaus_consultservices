# Execution Subcheckpoint 4B: MULTIMODAL INPUT READY

## Unidade concluída

Sprint 4B: entrada segura de imagens e documentos no Chat, mantendo o provider fake e sem iniciar voz.

## Origem

- branch: `develop`;
- checkpoint anterior: `WEB/PWA + CHAT READY`;
- validação humana do 4A.1: desktop e mobile aprovados pelo proprietário;
- Issue: #5, mantida aberta para 4C.

## Implementação

- seleção no composer de até quatro anexos;
- JPEG, PNG, WebP, PDF, TXT e Markdown;
- limite de aplicação de 10 MB por arquivo, abaixo do limite do bucket;
- validação de MIME, tamanho, nome e assinatura binária no servidor;
- normalização segura do nome do objeto;
- upload autenticado no bucket privado existente `pegasus-private`;
- caminho isolado por proprietário em `<owner_id>/chat/...`;
- registro em `documents` com classificação `internal` e origem externa `untrusted`;
- referências persistidas junto à mensagem e restauradas no histórico;
- Router seleciona capability `multimodal` quando há anexos;
- somente ID e media type chegam ao Core, nunca bytes brutos;
- provider fake permanece gratuito e não afirma ter analisado o arquivo;
- controles de anexos preparados no desktop e mobile;
- controle de voz permanece visível, desabilitado e sem implementação.

## Arquitetura e dados

Nenhuma migration, policy ou configuração de bucket foi alterada. O schema `documents`, o bucket privado e as regras de owner já existentes atendem à unidade. O acesso usa exclusivamente a sessão autenticada da requisição e as RLS existentes.

## Segurança e custos

- nenhuma API de IA paga;
- nenhuma API key nova;
- nenhuma service role no cliente;
- nenhum conteúdo de arquivo em logs;
- conteúdo externo continua não confiável;
- uma referência multimodal não concede autorização de ferramenta ou ação;
- nenhum serviço, upgrade, DNS ou infraestrutura adicional.

## Testes e quality gates

- `npm ci`;
- `npm run lint`;
- `npm run typecheck`;
- `npm test`;
- `npm run build`;
- validação de assinatura e rejeição de conteúdo incompatível;
- isolamento do caminho por proprietário;
- metadata de classificação e proveniência;
- transporte multipart no boundary autenticado;
- persistência das referências na mensagem;
- seleção multimodal no Core sem conteúdo bruto;
- auditoria de dependências;
- secret scan;
- CI e Preview HTTPS.

Os resultados e links finais são registrados na Issue #5 após a publicação do commit.

## Validação humana pendente

O proprietário ainda deve comprovar no Preview HTTPS o upload real com sua sessão, a persistência após refresh e a apresentação desktop/mobile. Esses pontos não são declarados como aprovados neste checkpoint técnico.

## Próxima atividade

Sprint 4C: Voice Interaction. Não iniciada. Deve permanecer bloqueada até a validação humana do 4B e uma nova autorização explícita.
