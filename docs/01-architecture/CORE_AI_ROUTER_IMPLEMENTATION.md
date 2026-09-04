# Pegasus Core and AI Router - Implementation Boundary

## Purpose

Sprint 3 establishes the provider-independent orchestration kernel. It does not make a model response an executable instruction and does not implement the future Context Engine, Memory Curator, Decision Guard or Tool Executor.

## Dependency direction

`packages/core` is framework-independent TypeScript. React, Next.js Route Handlers and infrastructure adapters may call the Core, but the Core does not import them.

The orchestration boundary is:

`Interaction Request -> Context Port -> AI Router -> Untrusted Model Response -> Core Response`

Consequential execution remains outside this Sprint and must preserve:

`Intent -> Permission -> Policy -> Decision Guard -> Approval -> Execution -> Audit`

## Core contracts

The Core exposes narrow ports for context, memory, tools, skills, permissions, policy, tasks, Decision Guard, approvals, devices, integrations, voice and audit. These ports define dependency direction only. Their complete implementations belong to later Sprints.

Model output is always returned with `modelOutputTrust: untrusted` and `executionAuthorization: none`. No textual model response can grant permission or call a Tool through the Sprint 3 Core.

## AI Router

Routing uses model descriptors and adapter IDs, not provider SDK types. Selection considers:

- requested capability and modality;
- minimum quality;
- latency preference;
- configured priority;
- provider availability;
- explicit permission to use paid models.

Model descriptors and adapters are supplied at composition time. A future real provider must be implemented outside the domain and registered behind `AiProviderAdapter`.

## Cost and fallback safety

Defaults are intentionally closed:

- paid models are not eligible unless the request explicitly allows them;
- fallback is disabled by default;
- a paid fallback additionally requires router policy to allow it;
- retries and fallback attempts are bounded;
- no provider credential is required for build, CI or fake-provider tests.

Usage and estimated token cost are returned when both usage and pricing are known. Unknown cost remains unknown instead of being presented as zero.

## Failures and cancellation

The public error surface is sanitized into stable error codes. Provider error messages are not emitted into Router traces. Each call receives a combined timeout and caller cancellation signal. Retry only applies to recoverable failures and stays within configured limits.

## Observability

Each attempt records structured metadata:

- correlation ID;
- duration;
- provider and model;
- status;
- usage;
- estimated cost when known;
- attempt and fallback marker;
- sanitized error code.

Prompts, model content and user content are excluded from the trace by contract.

## Fake provider

`FakeAiProvider` provides deterministic success, error, timeout and availability behavior. It validates routing, retry, fallback, cancellation, usage and cost without network access, API keys or paid consumption.

## Deferred work

- real provider adapters and secret-manager resolution;
- streaming transport integration with Web/PWA;
- complete Context Engine and Context Budget;
- memory/RAG and Knowledge Store;
- Tool execution and Skills runtime;
- complete Permission, Policy, Decision Guard and Approval pipeline;
- persistence of Router traces in the operational data store.
