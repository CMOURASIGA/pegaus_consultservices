# Pegasus Device Gateway Protocol V1

## Status

- implementation branch: `feat/device-agent-local-loop`
- transport: HTTPS request/response with adaptive polling
- Agent: .NET 8 Worker Service on Windows
- Cloud components: TypeScript
- first capability: `filesystem.list`
- persistent WebSocket: out of scope
- arbitrary shell: prohibited

## Security invariants

1. Model output is untrusted and has `executionAuthorization: none`.
2. Only deterministic Permission, Policy and Decision Guard evaluation may advance an action.
3. Unknown state fails closed.
4. Agent credentials and private keys never enter prompts, browser code, logs or command payloads.
5. A paired Agent receives only capabilities explicitly granted to its device.
6. Approval authorizes one exact action fingerprint and is consumed atomically.
7. Commands are typed, expiring, leased and idempotent.
8. The Agent independently validates command authenticity, device identity, capability, parameters, nonce, expiry and replay state.
9. Frontend access is read-only for operational state. Sensitive mutation is server-side.
10. Every state change uses one correlation ID across conversation, Task, decision, approval, command, execution and result.

## Actors

### Owner session

An authenticated Pegasus Web/PWA session. It may request pairing, approve or reject decisions, view state and revoke a device through protected server endpoints. It does not mutate operational tables directly.

### Pegasus Core

Interprets the interaction and may propose an action. The proposal contains no execution authority.

### Task Runtime

Owns Task lifecycle, step progress, cancellation, retry and completion. Only this runtime may declare an operational Task complete after validating the execution receipt and result.

### Decision Guard

Deterministically evaluates actor, trusted session, device, capability, operation, target, payload fingerprint, risk, permission, policy and approval requirement. Results:

- `PROCEED`
- `APPROVAL_REQUIRED`
- `REJECT`
- `UNKNOWN`

`UNKNOWN` is equivalent to deny for execution.

### Device Gateway

Authenticates the Agent, manages pairing, heartbeat, command leases, receipts, results, replay prevention and revocation.

### Device Agent

A .NET 8 Worker Service. It stores its private identity locally, polls the Gateway, validates every command and executes only allowlisted operations inside local capability constraints.

## Agent identity

The Agent creates an asymmetric key pair locally. The private key remains in Windows protected storage and is never uploaded.

The pairing request sends:

- ephemeral pairing token;
- public key;
- friendly name;
- OS and Agent version;
- requested capabilities;
- random registration nonce.

After approved pairing is consumed, the device is bound to the public key. Every authenticated Agent request includes:

- device ID;
- timestamp;
- unique request nonce;
- body digest;
- signature over canonical request data.

The Gateway rejects unknown, revoked, expired, duplicate, future-skewed or invalidly signed requests.

V1 does not store a reusable plaintext Agent secret in the database.

## Pairing

1. Agent creates a local identity and requests a short-lived challenge.
2. Gateway stores only a one-way hash of the pairing token.
3. Owner sees device identity and requested capabilities.
4. Owner approves or rejects through a server endpoint.
5. Agent submits the raw token once with its public key and registration nonce.
6. Gateway atomically verifies pending state, hash, expiry and approval, then consumes the challenge.
7. Device receives only the granted trust, execution level and capabilities.
8. Reuse of the challenge is rejected and audited.

Pairing approval does not approve an operational command.

## Heartbeat and adaptive polling

The Agent posts a signed heartbeat containing minimum operational metadata:

- Agent version;
- OS version;
- announced capabilities;
- local availability;
- timestamp and nonce.

Online state is derived from `last_seen_at` and a server threshold, not trusted from a client-set flag.

Recommended V1 cadence:

- active command or waiting Task: 5 seconds;
- paired and idle during human validation: 20 seconds;
- prolonged idle: 60 seconds;
- transient failure: exponential backoff with jitter, capped at 5 minutes;
- revoked response: stop polling until explicit new pairing.

The Gateway may return `nextPollAfterMs`. The Agent enforces a safe local minimum to avoid accidental tight loops.

## Proposed action

A provider-independent proposed action contains:

```json
{
  "taskId": "uuid",
  "deviceId": "uuid",
  "capability": "filesystem.list",
  "operation": "filesystem.list",
  "target": "authorized-root-alias",
  "parameters": {
    "relativePath": "."
  },
  "correlationId": "uuid"
}
```

Raw shell, PowerShell, CMD and model-generated executable text are invalid operations.

## Canonical fingerprint

Before approval or dispatch, the backend canonicalizes:

- owner ID;
- Task ID;
- device ID;
- capability;
- operation;
- target;
- normalized typed parameters;
- risk level;
- protocol version.

The SHA-256 digest is stored as `action_fingerprint`.

Any difference between approved and dispatched content invalidates the approval. The raw approval payload may remain available to the owner, but comparison is always performed using server-generated canonical form and fingerprint.

## Command record

A command contains:

- action ID and idempotency key;
- Task and Task step;
- owner and device;
- capability and operation;
- typed parameters;
- target/root alias;
- action fingerprint;
- unique command nonce;
- protocol version;
- status;
- attempt count;
- available time;
- expiration;
- lease owner/token and lease expiration;
- approval reference when required;
- correlation ID.

The Agent never receives privileged Supabase credentials.

## Polling and lease

1. Agent sends an authenticated poll.
2. Gateway derives device state and verifies capability grants.
3. Gateway atomically selects one eligible queued command.
4. Gateway creates a time-limited lease and changes it to dispatched.
5. Agent acknowledges receipt using the lease token.
6. Expired unacknowledged leases may return to queued only if policy, approval, device trust and expiry remain valid.
7. Reacquiring a command never changes its idempotency key.
8. A completed or currently executing idempotency key is not executed again.

Only one active lease may exist for an action.

## Approval

When Decision Guard returns `APPROVAL_REQUIRED`:

1. create Decision Inbox Item;
2. create Approval linked to Task;
3. store exact action fingerprint, device, capability, target, risk and expiry;
4. set Task to `waiting_approval`;
5. do not create an executable command yet;
6. owner approves or rejects through a server endpoint;
7. runtime atomically revalidates session, device, capability, fingerprint, expiry and status;
8. approval changes from approved to consumed in the same transaction that makes the command dispatchable.

Pending, rejected, revoked, expired or consumed approvals never dispatch.

## Receipt and result

The Agent posts two signed concepts:

### Receipt

Confirms whether the command was accepted for execution. It includes action ID, lease token, nonce, Agent timestamp and state `accepted` or `rejected`.

### Result

Includes:

- action ID and idempotency key;
- execution attempt ID;
- status;
- started and completed timestamps;
- typed sanitized output;
- error code from an allowlist;
- Agent version;
- evidence digest when applicable;
- correlation ID;
- result nonce and signature.

The Gateway verifies signature, lease relationship, device, attempt, nonce, schema and output limits. Invalid results do not complete the Task.

## Retry and timeout

Retries are controlled by the Gateway, not by the model.

Retry is allowed only for explicitly classified transient failures. Each retry:

- retains action ID and idempotency key;
- increments attempt number;
- receives a new lease and command nonce;
- revalidates device, policy, capability and approval validity;
- respects maximum attempts and total expiry.

Permanent validation, permission, revocation, policy, path or fingerprint failures are not retried.

## Replay protection

The Gateway stores or otherwise atomically tracks used request and command nonces for their validity window.

Reject:

- duplicate request nonce;
- duplicate result nonce;
- expired timestamp;
- mismatched body digest;
- mismatched device signature;
- command already completed;
- command lease belonging to another attempt;
- approval already consumed for another action.

The Agent keeps a local idempotency journal sufficient to reject redelivery after process restart.

## Revocation

Revocation is a backend mutation initiated by an authenticated owner session.

It:

- sets the device to revoked;
- invalidates Agent identity credentials;
- revokes capability grants;
- cancels or blocks queued commands;
- invalidates active leases;
- re-evaluates related sessions and Tasks;
- records security and audit events.

The Agent receiving a revoked response stops polling and cannot reconnect through the previous identity. New operation requires explicit pairing under policy.

## Task state integration

Supported transitions are defined by the Task Runtime, never accepted as arbitrary client input.

Relevant paths:

- `planning → queued → running → completed`
- `running → waiting_approval → queued`
- `running → waiting_device → queued`
- `queued|running|waiting_* → cancelled`
- `running → failed|partially_completed`

When no eligible online device exists after authorization, the Task enters `waiting_device`. A valid heartbeat may schedule a single idempotent resume. Resume revalidates guard, approval and capability before dispatch.

## filesystem.list V1

The command references a configured root alias, never a free absolute root supplied by the cloud.

Parameters:

- `relativePath`, default `.`;
- optional maximum entries within server and Agent limits.

The Agent:

1. resolves the configured root;
2. combines and canonicalizes the relative path;
3. rejects rooted input, traversal segments and invalid names;
4. resolves reparse points/junctions/symlinks;
5. verifies the final resolved path remains inside the authorized root;
6. lists only the immediate directory;
7. returns bounded metadata, never file content;
8. sanitizes names and errors.

V1 does not recurse and does not follow junctions or symbolic links outside the root.

## Audit events

All relevant events use the same correlation ID:

- interaction proposed action;
- Task created and transitioned;
- guard evaluated;
- approval requested, decided and consumed;
- device paired, heartbeat, offline or revoked;
- command queued, leased, acknowledged, retried or expired;
- execution accepted, completed or failed;
- result validated or rejected;
- Task completed, failed or cancelled.

Audit metadata excludes prompts, chat content, access tokens, raw pairing tokens, private keys, signatures, unrestricted filesystem paths and sensitive file content.

## HTTP endpoint boundary

Conceptual server routes:

- owner session:
  - `POST /api/devices/pairing/approve`
  - `POST /api/devices/pairing/reject`
  - `POST /api/devices/:id/revoke`
  - `POST /api/approvals/:id/approve`
  - `POST /api/approvals/:id/reject`
  - `POST /api/tasks/:id/cancel`
- Agent:
  - `POST /api/device-agent/pairing/request`
  - `POST /api/device-agent/pairing/consume`
  - `POST /api/device-agent/heartbeat`
  - `POST /api/device-agent/commands/poll`
  - `POST /api/device-agent/commands/:id/receipt`
  - `POST /api/device-agent/commands/:id/result`

Exact route names may change during implementation, but trust boundaries and protocol invariants may not.

## Versioning

Every Agent request and command declares protocol version `1`. Unsupported versions fail closed with a sanitized upgrade-required response.

Minimum Agent version is a server policy. Version rejection cannot be overridden by model output.

## V1 exclusions

- persistent WebSocket;
- screen capture;
- arbitrary terminal;
- unrestricted filesystem;
- administrator elevation;
- application automation;
- silent installation;
- continuous monitoring;
- Meeting Copilot;
- external integrations.
