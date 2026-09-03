# Application Foundation - Technical Decision

## Status

Accepted for Sprint 1 on 2026-09-03.

## Context

Pegasus V1 needs one responsive Web/PWA, a secure server-side API boundary, streaming support, eventual persistent workers, containerized self-hosting on Google Compute Engine and operation within approximately 0.5 vCPU and 2 GiB RAM. The UI must not call models or privileged database operations directly.

## Decision

Use a TypeScript monorepo with npm workspaces:

```text
apps/web        Next.js App Router Web/PWA and initial HTTP API
apps/worker     Persistent task/scheduler process introduced only when required
packages/core   Provider-independent Pegasus contracts and orchestration
packages/config Typed environment/configuration contracts
packages/logging Structured logging and redaction
packages/shared Shared schemas, errors and health contracts
```

Sprint 1 implements `apps/web` and the shared foundation packages. `apps/worker` receives only the minimum executable boundary needed for health and future Task processing. Feature logic remains outside route handlers and React components.

## Runtime and deployment

- current stable Next.js App Router, pinned through the lockfile;
- Node.js runtime by default;
- `output: standalone` for a minimal Docker image;
- single application instance in V1, consistent with the approved VM size;
- no Edge runtime without a measured requirement;
- no Redis, distributed cache or additional infrastructure without evidence;
- no production deployment during Sprint 1;
- Google Compute Engine remains the approved production target;
- Vercel may be used later for previews only if explicitly approved and without changing the self-hosted architecture.

## API boundary

Next.js Route Handlers expose health and integration/webhook endpoints. UI-originated mutations may later use Server Actions when their authorization and audit contracts are defined. Route handlers remain adapters and delegate to `packages/core`.

The AI Router, Memory, Context, Decision Guard, integrations and Device Gateway must not be implemented inside React components or route handlers.

## Supabase access

- browser: publishable key only, RLS enforced;
- server: privileged credential only in server-only modules and only for backend-managed operations;
- no `service_role` variable may use a `NEXT_PUBLIC_` prefix;
- startup/config validation must reject a public exposure pattern;
- health checks disclose no project keys, tokens or connection details.

## Configuration

Environment variables are validated with Zod at their consumption boundary. Public and server-only schemas are separate. `.env.example` contains names and safe descriptions only.

The application must not require paid services to run its local checks. External dependencies support explicit degraded or mock states where this does not hide a production failure.

## Logging and errors

- structured JSON logs on the server;
- correlation/request ID propagated when available;
- redaction for authorization, cookies, tokens, passwords, secrets, API keys and recovery codes;
- stable public error envelope with sanitized message and correlation ID;
- internal error details remain server-side and are also sanitized;
- no prompt, document or user content is logged by default.

## Health model

`GET /api/health` returns one of:

- `healthy`: application and required dependencies respond;
- `degraded`: application responds but an optional/external dependency is unavailable or not configured in development;
- `unavailable`: a required runtime dependency fails.

The response includes component status, timestamp and application version, but never credentials or raw provider errors.

## PWA

Sprint 1 supplies manifest, installability metadata, icons/assets owned by the project and a conservative service-worker strategy. Authentication responses, APIs and private user content must not be cached for offline reuse. Offline UX begins as a safe unavailable state rather than a private-data cache.

## Quality gates

Every commit intended as a checkpoint must pass:

```text
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

CI runs these gates on pushes and pull requests without deployment or use of production secrets.

## Security headers

The web application establishes a conservative baseline for CSP, frame protection, content-type sniffing, referrer policy and permissions policy. Camera and microphone remain disabled by default at the page/feature level until a future authorized flow explicitly requests them.

## Alternatives considered

### Separate frontend and Python backend from Sprint 1

Rejected for the initial foundation because it increases processes, images and operational overhead on the small V1 VM before a Python-specific workload exists. A separate service can be introduced behind a stable Core contract when voice, vision or workers justify it.

### Vercel-only deployment

Rejected as the primary architecture because persistent workers, Device Gateway and approved infrastructure target a long-running VM. The application remains portable and self-hostable.

### Edge-first runtime

Rejected because Pegasus needs Node.js libraries, server-side secrets, database access and future streaming/device processes. Edge remains an evidence-driven exception.

## Consequences

- one language and one lockfile reduce Sprint 1 complexity;
- the Core remains replaceable and testable outside Next.js;
- a future persistent worker can share contracts without importing UI code;
- single-instance assumptions must be revisited before horizontal scaling;
- persistent Task execution must not be placed in request lifecycle code;
- the visual identity remains provisional until its own approved design activity.

## Explicit non-decisions

This document does not select AI providers/models, voice providers, notification vendors, OAuth credentials, paid infrastructure or production DNS. Those decisions stay parametrized or wait for their corresponding Sprint and approval rule.
