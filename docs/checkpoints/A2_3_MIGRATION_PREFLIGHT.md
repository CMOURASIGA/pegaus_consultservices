# A2.3 - MIGRATION PREFLIGHT READY

Status: **READY** em `16fe78a6f1c7882abe159ab26275296a742f1b4a`.

A migration `011_device_agent_local_loop.sql` permanece **não aplicada** ao projeto Supabase real.

## Evidência executável

Ambiente descartável: Supabase local iniciado pelo GitHub Actions, com Supabase CLI fixado e PostgreSQL isolado no runner em `127.0.0.1:54322`.

Workflow: [Migration Preflight #10](https://github.com/CMOURASIGA/pegaus_consultservices/actions/runs/34890026841), concluído com sucesso.

A baseline efetiva foi reconstruída com as migrations `001` a `006` e `008` a `010`. A migration histórica `007` foi deliberadamente excluída da reconstrução porque tenta alterar default privileges pertencentes a `supabase_admin`, operação que não é reaplicável pelo papel local do runner. A exclusão reproduz o schema efetivo auditado e não propõe replay no projeto hospedado.

Resultado: aplicação integral da `011` e **42 assertions de banco aprovadas**.

## Provas concluídas

- objetos, constraints, foreign keys, índices, trigger e seis funções operacionais criados;
- RLS habilitado nas seis novas tabelas;
- funções `security definer` com `search_path = public`;
- `PUBLIC`, `anon` e `authenticated` sem EXECUTE nas funções server-only;
- `service_role` com os acessos operacionais necessários;
- `authenticated` preservado somente para as leituras previstas;
- mutação direta de `devices`, `tasks` e `task_steps` negada ao frontend;
- uma única transição concorrente de Task vence com optimistic concurrency;
- Approval consumida uma única vez;
- command lease adquirido por um único Agent;
- idempotent replay retorna o command existente;
- mesma idempotency key com fingerprint divergente falha fechada;
- nonce reutilizado é rejeitado;
- alterações de payload, device, capability, operation, owner ou Task invalidam o fingerprint;
- `Approval -> Authorized Command` ocorre atomicamente;
- falha intermediária não consome Approval, não cria command e não avança Task.

## Alterações finais da 011

- lock explícito `FOR UPDATE` na transição de Task;
- qualificação das colunas para eliminar ambiguidade SQL;
- garantias de uniqueness para idempotência e replay protection;
- grants e policies owner-read/backend-write;
- revogação explícita de execução das funções privilegiadas;
- fixture concorrente ajustada para materializar uma função volátil composta uma única vez por chamada, sem duplicar efeitos durante o teste.

## Impacto esperado no schema real

### Objetos existentes alterados

- `devices`: policy do owner passa de CRUD para SELECT; INSERT/UPDATE/DELETE de `authenticated` são revogados;
- `tasks`: policy do owner passa de CRUD para SELECT; INSERT/UPDATE/DELETE de `authenticated` são revogados; adiciona `idempotency_key`, `state_version` e `correlation_id`;
- `task_steps`: policy do owner passa de CRUD para SELECT; INSERT/UPDATE/DELETE de `authenticated` são revogados;
- `approvals`: adiciona `device_id`, `capability`, `target` e `action_fingerprint`;
- `tools` e `tool_capabilities`: registra a operação homologada `filesystem.list`.

### Objetos adicionados

- `device_capability_grants`;
- `device_agent_identities`;
- `device_request_nonces`;
- `device_commands`;
- `device_execution_attempts`;
- `device_command_results`;
- trigger `device_commands_set_updated_at`;
- seis funções operacionais server-only;
- constraints e índices de suporte.

Nenhum objeto da `011` existe no projeto real na conferência read-only de 2026-09-15.

## Quality final

[Quality #63](https://github.com/CMOURASIGA/pegaus_consultservices/actions/runs/34890026853) concluído com sucesso:

- `npm ci`;
- lint;
- typecheck;
- 152 testes em 31 arquivos;
- build;
- smoke standalone;
- dependency audit de produção com 0 vulnerabilidades;
- secret scan em 208 arquivos rastreados.

O status Vercel associado ao commit também está verde.

## Recovery plan

Resposta preferencial a incidente, sem apagar evidências:

1. interromper dispatch revogando EXECUTE de `acquire_device_command_lease` e `create_authorized_device_command` para `service_role`;
2. revogar grants ativos e identidades de Agent;
3. cancelar ou expirar commands pendentes por transação backend auditada;
4. preservar commands, attempts, receipts, results e audit events para investigação;
5. restaurar policies e grants anteriores somente se compatibilidade exigir, depois de desabilitar o runtime;
6. remover funções, trigger, tabelas, colunas ou constraints somente por migration de recovery separada, revisada e precedida por exportação dos dados novos.

Não existe down migration destrutiva automática.

## Plano de aplicação segura

1. reconfirmar o alvo `ussapugthlullzlvirxh` e status saudável;
2. repetir inventário read-only do schema, policies, grants, funções e histórico formal;
3. comparar o hash da `011` com o artefato validado;
4. confirmar CI verde e ausência de alterações posteriores executáveis;
5. registrar snapshot lógico dos objetos afetados e contagens de linhas;
6. aplicar somente `011_device_agent_local_loop.sql` com o mecanismo de migration do Supabase;
7. não executar `001` a `010` e não reconciliar o histórico antigo nesta operação;
8. executar pós-check read-only de objetos, grants, RLS, policies e funções;
9. repetir probes de bloqueio para `authenticated` e autorização para `service_role`;
10. confirmar integridade e contagens dos dados existentes;
11. executar smoke do código consumidor sem iniciar dispatch externo;
12. se houver falha, interromper o novo runtime e seguir o recovery plan, preservando dados e auditoria.

A aplicação depende de autorização separada do proprietário.

## Próximo checkpoint

Após aplicação segura da migration real: `A3 - DEVICE GATEWAY HTTPS`.

Pendência registrada: reduzir Preview Deployments desnecessários da Vercel para alterações sem impacto executável, preservando Preview para qualquer alteração potencialmente executável. Esta manutenção não faz parte do A2.3.
