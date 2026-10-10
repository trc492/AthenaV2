# Core architecture

Athena is a configuration-driven scouting application with interchangeable database providers and offline scouting support.

## Dependency direction

UI components use feature hooks and API clients. Route handlers authenticate, validate requests, and translate domain errors into HTTP responses. Domain services depend on persistence contracts; database adapters implement those contracts.

```text
UI → feature hooks → API client → route → domain service → persistence contract → adapter
```

- `src/lib/types/db/service.ts` defines scouting, event, picklist, account, guest-link, and maintenance contracts. `DatabaseService` composes them for provider implementations. Features should depend on the smallest contract they need.
- `src/lib/server/db-service.ts` resolves the active provider. Resolve it for each request so database reconfiguration takes effect immediately. Never retain an adapter in a route-level variable.
- `src/lib/server/require-permission.ts` centralizes API permission checks. Guest-readable routes must additionally use the request-local `guestDatabase` facade.
- `src/lib/server/scouting-schema.ts` validates scouting writes. Client-supplied ownership is ignored on creation and rejected on updates. `scouting-service.ts` owns duplicate checks and edit ownership rules.
- `src/lib/game-config/` contains shared, pure configuration validation and scoring. It is usable in both client and server code. HTTP handlers should not define another scoring implementation.
- `src/lib/schedule/assignments.ts` contains pure scheduling algorithms; schedule components render their results.

## Browser data and offline behavior

`useAsyncData` keys requests by their scope and prevents older requests from overwriting newer results. Keys must include every input that changes the result, including competition, season, event, and session identity when relevant.

`requestJSON` reports structured `HttpError` values. `loadWithOfflineCache` shares the offline-read policy: authenticated users can use downloaded data when offline or when the server is unavailable; guests require an online server response. A client error such as 401 or 403 must never be hidden by cached data.

Scouting submissions share one queue policy: offline, transport failures, timeouts, and server failures may queue entries. Conflicts and other client errors are surfaced immediately. The queue manager owns retries; IndexedDB owns storage.

Downloaded event caches use the composite key `[eventCode, year, competitionType]`. All readers, writers, status checks, and clears must use the same `EventScope`.

IndexedDB schema version 6 recreates event caches previously keyed only by event code. Users must download those caches again while online. The upgrade preserves queued scouting submissions, synchronization logs, configuration, event lists, and scout lists.

## Boundaries and checks

Put pure reusable logic in shared domain modules. Put secrets, provider initialization, authentication, and request handling in server modules. Extract a helper when it centralizes a rule or a repeated operation; keep feature-specific operations named and explicit.

Typecheck rejects unused locals and parameters. Documentation examples are reference material and are excluded from application compilation and lint. Before merging, run typecheck, lint, unit tests, and the relevant Playwright tests. Cache isolation and schema migration are tested against Chromium's actual IndexedDB.
