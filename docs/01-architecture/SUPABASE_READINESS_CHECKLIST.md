# Supabase Readiness Checklist

**Projeto:** `pegaus_consultservices`  
**Project ref:** `ussapugthlullzlvirxh`  
**Região:** `sa-east-1`  
**PostgreSQL:** 17  
**Auditoria final:** 2026-09-03  
**Status:** **READY FOR APPLICATION DEVELOPMENT**

## Resultado executivo

A fundação Supabase está saudável e pronta para o desenvolvimento da aplicação. A auditoria foi executada contra o projeto remoto real, não somente contra os arquivos SQL. Os gaps comprovados foram consolidados na Migration 010, aplicados e revalidados.

Não há dependência de Supabase Pro para desenvolvimento da V1. Backups avançados, proteção contra senhas vazadas e demais recursos eventualmente dependentes de plano devem ser reavaliados como `FUTURE GO-LIVE REQUIREMENT`, sem bloquear o desenvolvimento.

## Migrations

| Migration | Estado | Observação |
|---|---|---|
| 001 a 009 | Aplicadas e validadas no schema remoto | Foram executadas originalmente pelo SQL Editor e não aparecem no histórico do Supabase CLI |
| 010 | Aplicada e validada | Fecha gaps de recovery codes, privilégios backend, policies e índices de FKs |

Arquivo de fechamento: `supabase/migrations/010_supabase_foundation_closure.sql`.

### Reconciliação futura do histórico

Antes do primeiro deploy automatizado de banco:

1. vincular o Supabase CLI ao project ref correto;
2. comparar o schema remoto com `supabase/migrations/001...010` em ambiente descartável;
3. marcar 001 a 009 como baseline aplicada usando o mecanismo de repair da versão instalada do CLI;
4. confirmar com `supabase migration list` que local e remoto representam o mesmo estado;
5. executar `db diff` e exigir diff vazio antes de habilitar pipeline de migrations.

Os comandos exatos devem ser confirmados com `supabase migration --help` na versão instalada. Não automatizar migrations antes dessa reconciliação.

## Security Advisors

Após a Migration 010 permanecem somente avisos conhecidos:

- `audit_events`: RLS ativo e nenhuma policy. Estado deliberado, tabela backend-only sem privilégios para `anon` ou `authenticated`.
- `recovery_codes`: RLS ativo e nenhuma policy. Estado deliberado após remoção do acesso aos hashes pelo cliente.
- proteção contra senhas vazadas desabilitada: registrar para reavaliação antes do go-live, conforme disponibilidade do plano. Não bloqueia desenvolvimento.

Nenhum desses avisos representa exposição de dados ao cliente.

Referências dos advisors:

- [RLS enabled without policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Password security and leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

## Performance Advisors

- 35 foreign keys sem índice: corrigidas, validação final `0`.
- 31 policies com chamada direta de `auth.uid()` por linha: corrigidas, validação final `0`.
- índices não utilizados: esperado porque as tabelas operacionais ainda estão vazias. Não remover índices de ownership, relacionamentos ou HNSW com base nesse sinal inicial.

## RLS, policies e grants

- todas as 39 tabelas de domínio em `public` possuem RLS ativo;
- nenhuma tabela pública concede CRUD a `anon`;
- tabelas owner-managed usam predicado de proprietário;
- tabelas operacionais são somente leitura para o usuário quando aplicável;
- `audit_events` e `recovery_codes` são backend-only;
- as tabelas backend-managed possuem privilégios CRUD explícitos e limitados para `service_role`;
- `service_role` não deve ser usado no frontend nem em variáveis públicas;
- RLS continua sendo defesa de dados, não substituto do Permission Engine e Decision Guard.

## Functions e schemas

- `private.match_memories` e `private.match_document_chunks` são `SECURITY INVOKER`;
- somente `service_role` possui `USAGE` no schema `private` e `EXECUTE` nas funções de recuperação;
- `anon` e `authenticated` não possuem acesso ao schema `private`;
- `handle_new_auth_user` é o único helper privilegiado necessário para o bootstrap e usa `search_path` vazio;
- helpers de trigger não são RPCs públicas;
- nenhuma função privilegiada ficou executável por roles de cliente.

Mesmo que uma configuração futura da Data API seja alterada, a fronteira de schema e os grants impedem acesso das roles públicas ao conteúdo privado. Confirmar visualmente `public` como único schema de aplicação exposto antes do go-live.

## Auth, MFA e sessões

- projeto contém 2 usuários Auth e 2 profiles correspondentes;
- usuários Auth sem profile: `0`;
- estruturas nativas de TOTP/MFA presentes;
- nenhum fator MFA cadastrado ainda;
- o frontend deve implementar enrollment, challenge, recuperação e compreensão de `aal1`/`aal2`;
- não exigir `aal2` globalmente antes do fluxo funcional;
- Passkeys/WebAuthn ficam para depois de domínio, HTTPS, origin e RP ID definitivos;
- `pegasus_sessions`, `device_pairing_challenges`, `recovery_codes` e `auth_security_events` estão protegidas;
- recovery codes armazenam somente hashes e não são legíveis pelo cliente.

## Storage

- bucket `pegasus-private` existe e está privado;
- limite atual por objeto: 25 MiB;
- MIME types restritos aos formatos aprovados;
- SELECT, INSERT, UPDATE e DELETE exigem usuário autenticado e primeiro segmento do caminho igual a `auth.uid()`;
- nenhuma policy pública ou `anon`;
- UPDATE/DELETE direto permanece no V1 para arquivos do próprio usuário. A aplicação deve passar pelo Decision Guard quando a ação tiver consequência relevante.

## pgvector e RAG

- extensão `vector` ativa, versão `0.8.2`;
- embeddings de `memories` e `document_chunks`: dimensão 1536;
- índices HNSW com cosine distance presentes;
- modelo e data de embedding são obrigatórios quando existe vetor;
- funções de retrieval são backend-only;
- `match_document_chunks` exclui documentos `sensitive`;
- mudanças de modelo/dimensão exigem migration e reindexação controladas.

## Realtime e Edge Functions

- nenhuma tabela Pegasus publicada em `supabase_realtime`;
- nenhuma Edge Function implantada;
- nenhum recurso foi habilitado antecipadamente sem necessidade concreta da V1.

## Backups e plano

- permanecer no plano atual durante desenvolvimento e validação;
- não solicitar upgrade para Supabase Pro como condição da V1;
- antes de produção, revisar política de backups, retenção, restore testado e recursos de segurança disponíveis;
- eventual upgrade é decisão exclusiva do proprietário e deve ser tratado como `FUTURE GO-LIVE REQUIREMENT`.

## Itens deliberadamente transferidos para aplicação/deploy

- fluxo funcional de TOTP e step-up para `aal2`;
- expiração, revogação e UX de dispositivos/sessões;
- backend seguro para geração, consumo e regeneração de recovery codes;
- configuração de secrets exclusivamente server-side;
- validação final de Data API no dashboard antes de go-live;
- Passkeys após domínio oficial e HTTPS;
- reconciliação do histórico para CI/CD de migrations;
- política final de backups e teste de restore antes de produção.

## Evidências finais

- projeto remoto: `ACTIVE_HEALTHY`;
- tabelas públicas sem RLS: `0`;
- foreign keys sem índice: `0`;
- policies com `auth.uid()` não otimizado: `0`;
- tabelas backend-managed sem privilégios necessários: `0`;
- usuários sem profile: `0`;
- acesso de `authenticated` a recovery-code hashes: `false`;
- acesso de `anon`/`authenticated` ao schema e retrieval privados: `false`;
- execução de retrieval por `service_role`: `true`;

## Decisão

**READY FOR APPLICATION DEVELOPMENT**

A fundação Supabase está encerrada. Os itens restantes dependem de frontend, domínio/HTTPS, configuração de go-live ou decisão futura de plano e não bloqueiam a próxima fase.
