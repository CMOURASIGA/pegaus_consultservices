# Drive e documentos: implementação da Sprint 6

## Objetivo

O Knowledge Store recupera trechos relevantes de documentos autorizados sem misturar conhecimento documental com memória pessoal e sem permitir que conteúdo externo altere permissões ou políticas do Pegasus.

## Boundaries

- `packages/core/src/knowledge-store.ts`: contratos de fonte, repositório, ingestão incremental, chunking, retrieval, erros e observabilidade.
- `apps/web/lib/knowledge/google-drive.ts`: adapter server-side somente leitura para Google Drive.
- `apps/web/lib/knowledge/store.ts`: persistência em `documents`, `document_versions` e `document_chunks`.
- `packages/core/src/context-engine.ts`: composição de memórias e trechos documentais sob o mesmo Context Budget.
- `/knowledge`: catálogo autenticado e estado da conexão, sem tokens ou conteúdo sensível.

O Core não depende de Google, Supabase, Next.js ou React. O adapter fake permite CI determinístico sem OAuth e sem consumo pago.

## Segurança

Todo trecho documental recebe `trust: untrusted_external`. A proveniência enviada ao Core contém documento e chunk, e o prompt do Core determina que conteúdo externo é dado, nunca autorização. Nenhuma instrução recuperada pode pular a cadeia:

Documentos classificados como `sensitive` ou que contenham formato reconhecível de credencial falham fechados antes da criação de chunks. Assim, conteúdo `SECRET` não entra no contexto do modelo.

`Intent -> Permission -> Policy -> Decision Guard -> Approval -> Execution -> Audit`

O identificador externo não aparece em traces; somente um hash curto é registrado. Tokens OAuth existem apenas no token provider server-side e nunca fazem parte do retorno do adapter, React, banco, logs ou documentação.

O acesso de leitura usa a sessão autenticada e RLS por `owner_id`. A gravação de chunks, que é backend-only no schema existente, exige service role apenas no servidor e sempre filtra o proprietário explicitamente.

## Ingestão incremental

1. a fonte lê um arquivo explicitamente autorizado;
2. conteúdo e metadados são normalizados;
3. o Core calcula SHA-256;
4. versão e hash iguais retornam `unchanged`;
5. mudança cria nova `document_version` e novos chunks;
6. o documento só recebe `ready` após todos os chunks serem gravados;
7. falha deixa o documento como `failed`, sem mascarar sucesso.

O documento original permanece no Drive. O Supabase guarda metadados, versão, hash e trechos necessários à recuperação.

## Retrieval inicial

O primeiro retrieval é lexical, determinístico e limitado. Apenas documentos `ready` do proprietário participam. O Context Engine aplica limites de quantidade e caracteres junto com as memórias. Embeddings e `private.match_document_chunks` já possuem fundação no banco, mas não serão usados até existir uma decisão explícita de modelo, custo e reindexação.

## Formatos

O adapter inicial lê texto, Markdown e exporta Google Docs como texto. Binários e formatos sem extrator aprovado falham fechados. PDF, imagem e outros formatos continuam classificados como não confiáveis, mas não são fingidos como indexados enquanto não houver extração comprovada.

## Bloqueio externo para validação real

A leitura real do Google Drive requer configuração OAuth do proprietário e um cofre server-side compatível com a arquitetura aprovada. Até isso existir, a aplicação mostra a integração como desconectada. Testes usam somente o adapter fake e não criam tokens ou registros reais.
