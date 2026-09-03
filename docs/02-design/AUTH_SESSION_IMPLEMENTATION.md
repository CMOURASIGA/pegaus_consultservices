# Auth and Session Implementation

## Scope

Sprint 2 implements conventional password authentication with Supabase Auth, secure SSR cookies, Pegasus application-session metadata, TOTP MFA and explicit assurance-level handling. Passkeys, WebAuthn, recovery codes and QR cross-device approval remain deferred according to the architecture.

## Runtime boundaries

- Browser code receives only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Server Components, Route Handlers and Proxy use a request-scoped SSR client backed by cookies.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and is required for application-session synchronization and security-event writes. In production it must come from Secret Manager.
- Server route protection validates signed claims with `getClaims()`. It never trusts `getSession()` for authorization.
- Authorization uses the `profiles.status` database field. `user_metadata` is not an authorization source.

## Routes

| Route | Purpose |
|---|---|
| `/login` | Password login for an authorized account |
| `/auth/login` | Credentials exchange, profile validation and application-session bootstrap |
| `/auth/bootstrap` | Safe recovery when cookies exist but Pegasus metadata needs synchronization |
| `/auth/logout` | Current-session revocation and local Auth logout |
| `/app` | Protected application entry point |
| `/security/mfa` | TOTP state and enrollment |
| `/security/mfa/challenge` | Challenge and verify for an already verified TOTP factor |
| `/sessions` | Owner-visible application sessions and revocation controls |

## MFA and AAL

The application calls the native Supabase MFA APIs: `enroll`, `challenge`, `verify`, `listFactors` and `getAuthenticatorAssuranceLevel`.

- A user without a verified factor may continue at `aal1` and can enroll from the protected security page.
- A user with a verified TOTP factor and `nextLevel=aal2` is redirected to the challenge after password login.
- `aal2` is accepted only after the Supabase verify operation and a fresh assurance-level read.
- No global `aal2` policy is enabled before the enrollment and challenge paths are operational.

## Session and revocation model

Supabase Auth remains the cryptographic session source of truth. `pegasus_sessions` stores only application context and the `auth_session_id` claim. The Proxy validates profile status and the matching Pegasus session on every protected navigation.

- Logout revokes the current Pegasus session before destroying local Auth cookies.
- Individual remote revocation blocks the selected session at the Pegasus boundary.
- The kill switch uses Supabase `signOut({ scope: 'others' })` and revokes all other Pegasus session rows.
- Security events are written by the server to `auth_security_events`; secrets, passwords, TOTP codes and raw tokens are never written.

## Local operation

Copy `.env.example` to `.env.local` and provide values through an approved secret channel. Never commit the file.

```bash
npm ci
npm run dev
```

Functional verification requiring a real account must use an authorized test user. Do not store its password or TOTP seed in fixtures.

## Known external validation

The code and mocked contracts can verify routing, login outcome handling, logout, expiration/revocation policy and AAL decisions without a real identity. A complete real TOTP enrollment/challenge/verify ceremony requires an authorized account password and an authenticator controlled by the owner. This must be recorded as an external blocker when those credentials are not available in the execution environment.
