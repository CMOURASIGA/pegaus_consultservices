# A2.3 Migration Preflight

Status: executable validation in progress. Migration 011 remains unapplied to the real Supabase project.

## Disposable environment

GitHub Actions starts a local Supabase stack with the pinned Supabase CLI and Docker. The database is bound only to the CI runner at 127.0.0.1:54322. The workflow reconstructs the disposable baseline from repository migrations, then runs database-level assertions against Migration 011.

This reconstruction is not a proposal to replay historical migrations in the real project. The hosted project was previously audited read-only and its formal migration history differs from its effective schema. Application to the hosted project will use the observed schema as its baseline.

## Scope of executable preflight

- migration execution and object inventory
- constraints, foreign keys, indexes, triggers, RLS and policies
- fixed search_path on security definer functions
- authenticated read-only behavior and denied operational mutations
- service_role-only execution privileges
- optimistic concurrency on Task transitions
- atomic Approval consumption and command creation
- fingerprint scope changes: payload, device, capability, operation, owner and Task
- idempotency key replay and fingerprint conflict
- exclusive command lease
- nonce replay protection

## Expected schema impact

### Existing objects altered

- devices: owner-facing policy changes from CRUD to SELECT; authenticated INSERT/UPDATE/DELETE revoked
- tasks: owner-facing policy changes from CRUD to SELECT; authenticated INSERT/UPDATE/DELETE revoked; idempotency_key, state_version and correlation_id added
- task_steps: owner-facing policy changes from CRUD to SELECT; authenticated INSERT/UPDATE/DELETE revoked
- approvals: device_id, capability, target and action_fingerprint added
- tools/tool_capabilities: allowlisted filesystem.list operation registered

### Objects added

- device_capability_grants
- device_agent_identities
- device_request_nonces
- device_commands
- device_execution_attempts
- device_command_results
- device_commands_set_updated_at trigger
- six server-only operational functions
- supporting constraints and indexes

## Recovery plan

The preferred incident response is non-destructive:

1. Stop dispatch immediately by revoking EXECUTE on acquire_device_command_lease and create_authorized_device_command from service_role.
2. Revoke active device_capability_grants and device_agent_identities.
3. Mark queued or leased commands cancelled or expired through an audited backend maintenance transaction.
4. Preserve commands, attempts, receipts, results and audit events for investigation.
5. If application compatibility requires it, restore the previous owner policies and authenticated table grants only after the vulnerable runtime is disabled. This temporarily restores the old risk profile and is not the preferred steady state.
6. Drop new functions, trigger, tables, columns or constraints only in a separately reviewed recovery migration after data export. No automatic destructive down migration is supplied.

## Remaining gate

The hosted Supabase project must remain unchanged until this workflow and the ordinary Quality workflow are green and the owner explicitly authorizes the hosted migration preflight/application step.
