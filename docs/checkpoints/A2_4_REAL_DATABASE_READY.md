# A2.4 - REAL DATABASE READY

Status: **READY** em 2026-09-15.

O checkpoint registra exclusivamente a aplicação controlada e o postflight da migration `011_device_agent_local_loop.sql`. O desenvolvimento do A3 não foi iniciado.

## Alvo

- Supabase project ref: `ussapugthlullzlvirxh`
- projeto: `pegaus_consultservices`
- região: `sa-east-1`
- PostgreSQL: `17.6`
- estado anterior: saudável, sem objetos da 011
- migration aplicada: somente `device_agent_local_loop`
- migration history resultante:
  - `20260903191639_supabase_foundation_closure`
  - `20260915153113_device_agent_local_loop`

Nenhuma migration histórica foi reaplicada.

## Artefato aplicado

- branch: `feat/device-agent-local-loop`
- HEAD anterior à aplicação: `29a3d3c225ae053280627ad4947816df73979fdd`
- arquivo: `supabase/migrations/011_device_agent_local_loop.sql`
- blob validado: `36dfc0307e96d80ef5d9f7154567c5d310becdc1`
- preflight descartável: Migration Preflight #11, 42 assertions aprovadas
- Quality anterior: Quality #64, aprovado

## Resultado da aplicação

A operação do Supabase retornou `success: true`.

Foram criadas:

- `device_capability_grants`
- `device_agent_identities`
- `device_request_nonces`
- `device_commands`
- `device_execution_attempts`
- `device_command_results`

Foram adicionadas as colunas de idempotência, versão e correlação em Tasks e o fingerprint operacional em Approvals.

Foram registradas as seis funções server-only:

- `transition_task`
- `request_device_action_approval`
- `decide_device_action_approval`
- `revoke_device_action_approval`
- `create_authorized_device_command`
- `acquire_device_command_lease`

## Postflight de segurança

Confirmado no banco real:

- RLS habilitado nas seis tabelas novas;
- owner pode ler somente as quatro estruturas operacionais previstas;
- identidades de Agent e nonces não possuem acesso de `authenticated`;
- `authenticated` não possui INSERT, UPDATE ou DELETE nas seis tabelas novas;
- `authenticated` não possui INSERT, UPDATE ou DELETE em `devices`, `tasks` e `task_steps`;
- `service_role` possui o acesso operacional previsto;
- as seis funções são `security definer` com `search_path = public`;
- `anon` e `authenticated` não possuem EXECUTE nas funções;
- `service_role` possui EXECUTE nas funções;
- policies antigas de CRUD foram substituídas por policies de SELECT por owner.

As tabelas sem policy de owner, `device_agent_identities` e `device_request_nonces`, permanecem intencionalmente backend-only e sem grants para clientes.

## Integridade

Contagens no postflight:

- conversations: 46
- messages: 147
- memories: 10
- memory_versions: 17
- tasks: 0
- task_steps: 0
- devices: 0
- approvals: 0
- commands: 0

A migration não contém exclusão de dados de negócio. Nenhuma fixture ou comando operacional foi criado no projeto real.

## Advisors

Security Advisor:

- informações de RLS sem policy em tabelas deliberadamente backend-only, incluindo as novas `device_agent_identities` e `device_request_nonces`;
- achados anteriores em `audit_events` e `recovery_codes`;
- proteção de senha vazada desabilitada, pendência anterior de hardening e go-live.

Performance Advisor:

- foreign keys novas sem índices dedicados adicionais;
- índices ainda não utilizados, comportamento esperado antes do A3 e do primeiro tráfego operacional.

Esses itens não concedem acesso indevido e não bloqueiam o A2.4. Os índices devem ser reavaliados com os padrões reais de consulta do Gateway, sem otimização especulativa.

## Recovery

Se surgir incidente antes do A3:

1. não iniciar o Gateway;
2. revogar EXECUTE das funções de lease e criação de command para `service_role`;
3. revogar capability grants e identidades de Agent, se existirem;
4. preservar tabelas, results, attempts e audit trail;
5. corrigir por migration revisada, sem down migration destrutiva automática.

No estado atual não há devices, grants, identities, commands ou executions para revogar.

## Próximo passo bloqueado

`A3 - DEVICE GATEWAY HTTPS` depende de nova autorização explícita.

Não foram iniciados Device Gateway, Agent Windows, filesystem.list E2E, integrações externas ou deploy de produção.
