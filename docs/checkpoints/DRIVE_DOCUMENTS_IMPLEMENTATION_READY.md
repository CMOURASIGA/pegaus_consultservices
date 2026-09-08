# Execution Checkpoint: DRIVE + DOCUMENTS IMPLEMENTATION READY

## Estado

Implementação independente de OAuth da Sprint 6 concluída na branch `develop`, partindo de `MEMORY + CONTEXT READY`. A Issue #7 permanece aberta porque a validação real de um documento autorizado do Google Drive exige configuração externa do proprietário.

## Entregas

- contratos de fonte, repositório, ingestão, chunking, retrieval, erros e observabilidade no Core;
- adapter fake determinístico sem credencial ou custo;
- adapter Google Drive somente leitura e estritamente server-side;
- persistência usando `documents`, `document_versions` e `document_chunks` existentes;
- indexação incremental por versão e SHA-256;
- histórico de versões preservado;
- retrieval lexical inicial limitado ao proprietário e a documentos `ready`;
- Context Engine combina memória e documentos sob o mesmo budget;
- proveniência por documento e chunk;
- conteúdo externo marcado como `untrusted_external`;
- documento sensível ou com formato de credencial rejeitado antes de gerar chunks;
- saída de modelo continua sem autoridade executiva;
- nova área autenticada `/knowledge` com estado real da integração e catálogo;
- nenhuma migration ou alteração de dados reais;
- documentação em `docs/03-memory/DRIVE_DOCUMENTS_IMPLEMENTATION.md`.

## Arquitetura e segurança

`packages/core` continua independente de React, Next.js, Supabase e Google. Tokens são fornecidos apenas por contrato server-side e nunca retornados pelo adapter. O identificador externo é reduzido a hash nos traces. O cliente autenticado lê sob RLS; escrita backend-only exige service role no servidor com `owner_id` explícito.

Conteúdo recuperado não altera a cadeia:

`Intent -> Permission -> Policy -> Decision Guard -> Approval -> Execution -> Audit`

## Banco real

Validação somente leitura confirmou `documents`, `document_versions`, `document_chunks`, tabelas de integração, pgvector 0.8.2, função privada `match_document_chunks` e policies de ownership. O schema existente é suficiente e nenhuma migration foi criada ou aplicada.

Advisors mantêm somente achados anteriores: tabelas deliberadamente backend-only sem policy, proteção contra senha vazada pendente para go-live e índices ainda sem uso em banco novo.

## Quality gates

- `npm ci`: aprovado;
- lint: aprovado, zero warnings;
- typecheck: aprovado;
- `npm test`: 87 testes em 25 arquivos, aprovados;
- build Next.js: aprovado;
- smoke standalone: login, `/app`, `/knowledge` protegido e manifest aprovados;
- dependency audit: zero vulnerabilidades;
- secret scan: aprovado em 184 arquivos rastreados;
- GitHub Actions: aprovado;
- Vercel Preview: aprovado.

CI: https://github.com/CMOURASIGA/pegaus_consultservices/actions/runs/34256682043

## Commit

- implementação remota: `da9e52dd5aca6ba002183851a29289b7c1cb9bc3`.

## Bloqueio externo

Para concluir a Sprint 6 é necessário:

1. projeto OAuth no Google Cloud autorizado pelo proprietário;
2. Google Drive API habilitada;
3. client ID, client secret e redirect URI configurados somente no backend;
4. escopo mínimo de leitura;
5. cofre server-side aprovado para refresh token, mantendo no Supabase apenas `secret_ref`;
6. autorização explícita de uma pasta ou documento de teste;
7. validação real de leitura, indexação incremental, recuperação e revogação.

Nenhuma credencial deve ser enviada pelo chat. A configuração externa pode ser feita sem API paga, mas pode exigir um projeto Google Cloud e configuração manual do consentimento OAuth.

## Pendências preservadas

- cerimônia real TOTP antes do go-live;
- evidências humanas restantes da Sprint 5, quando ainda não realizadas;
- PDF/imagem não são declarados indexados sem extrator comprovado;
- embeddings permanecem desativados até decisão explícita de modelo, custo e reindexação.

## Próxima retomada

Configurar OAuth e o cofre server-side, conectar uma fonte de teste autorizada e concluir a validação real da Issue #7. Não iniciar Sprint 7 antes disso.
