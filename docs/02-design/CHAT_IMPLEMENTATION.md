# Web/PWA and Chat Implementation

## Scope

Sprint 4A delivers the authenticated Pegasus shell and the first complete text flow. It uses the provider-independent Core from Sprint 3 and does not activate a commercial AI provider.

## Request flow

`ChatShell -> POST /api/chat -> ChatService -> PegasusCore -> AiRouter -> AiProviderAdapter`

React owns interaction state only. Authentication, owner checks, persistence, orchestration, routing and provider composition remain server-side.

## Persistence

The existing `conversations` and `messages` tables are sufficient. No migration was required.

- operations use the request-scoped Supabase client and the authenticated session;
- RLS restricts both tables by `owner_id`;
- queries also filter `owner_id` explicitly as application-level defense in depth;
- conversation continuation first verifies ownership;
- user and assistant messages share a correlation ID;
- provider/model metadata is stored only on assistant messages;
- model output is marked `untrusted` in message metadata.

## Provider mode

Development and CI use `FakeAiProvider` with a fixed, transparent response. It has zero pricing, requires no key and cannot invoke Tools. The interface visibly identifies this as `Modo local seguro`.

A real provider may only replace this composition server-side through `AiProviderAdapter`, with explicit cost policy and secret-manager integration.

## Error and cancellation behavior

The client uses `AbortController` to cancel its request. Provider errors, timeouts and cancellation are converted to stable application errors. Raw provider messages and user content are not logged.

The user can explicitly retry a failed message. No automatic paid fallback is enabled.

## PWA and privacy

The manifest starts at `/app` in standalone mode. The service worker caches only the public landing shell and icon. It explicitly excludes `/app`, `/api`, `/auth`, `/security` and `/sessions`, preventing chat, session and authenticated content from entering the persistent shell cache.

## Responsive and accessibility rules

- desktop uses a conversation sidebar and main chat region;
- mobile uses an explicit drawer and backdrop;
- `100dvh` and safe-area insets protect the composer on mobile;
- essential touch targets are at least 44px;
- the message region exposes busy/live state;
- the composer has an associated label and keyboard behavior;
- focus remains visible and animation respects reduced-motion preference;
- essential actions do not depend on hover or color alone.

## Deferred to Sprint 4B and 4C

- file/image upload and private Storage references;
- multimodal routing;
- microphone capture and Voice UX;
- STT/TTS adapters;
- full-duplex voice and interruption of synthesized audio.
