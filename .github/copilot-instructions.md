# AthenaV2 Copilot Instructions

## Project Overview

AthenaV2 is a modern, offline-first scouting and analytics platform for FIRST Robotics Competition (FRC) and FIRST Tech Challenge (FTC) teams. Built with Next.js 16, React 19, TypeScript, and Tailwind CSS v4, it provides dynamic form generation, multi-database support, real-time analytics, and progressive web app (PWA) capabilities for seamless competition scouting.

- **Package Manager**: `pnpm` (strictly use `pnpm`, never `npm` or `yarn`)
- **Build Validation**: Always run `pnpm build` after major code changes

---

## Architecture Overview

### 1. Frontend & UI
- **Framework**: Next.js 16 with App Router, React 19, TypeScript
- **UI Components**: Radix UI primitives with custom Tailwind CSS v4 styling
- **Icons**: Lucide React (`lucide-react`)
- **Charts & Visualizations**: Recharts, Embla Carousel, custom SVG field canvases
- **Theming**: Multi-theme system using OKLCH color space (Green, Blue, Purple, Rose, Orange) supporting light/dark modes via `next-themes`

### 2. Authentication & Authorization
- **Auth Engine**: NextAuth.js v5 (beta) (`next-auth`)
- **Role-Based Access Control**: Defined in `src/lib/auth/roles.ts` (Admin, Lead Scout, Scout, Viewer, etc.)
- **Configuration & Helpers**: `src/lib/auth/config.ts`, `src/lib/auth/types.ts`

### 3. Multi-Database Architecture
All database operations pass through an abstraction layer managed by `DatabaseManager` (`src/db/database-manager.ts`). Providers can be selected at runtime via environment variables or configured through the web onboarding/setup flow (`/setup`).

Supported Providers:
- **Azure SQL**: `src/db/azuresql-database-service.ts` (`mssql`)
- **MariaDB / MySQL**: `src/db/mariadb-database-service.ts` (`mysql2`)
- **Azure Cosmos DB**: `src/db/cosmos-database-service.ts` (`@azure/cosmos`)
- **Firebase Firestore**: `src/db/firebase-database-service.ts` (`firebase`, `firebase-admin`)

**Hardware Interface Principle:** Treat the `DatabaseService` interface as a hardware abstraction layer. No SQL, no dialect-specific syntax, and no provider details should ever appear outside of the `src/db/` directory. When you need a new database operation, add a method to `DatabaseService` in `src/lib/types/db/service.ts`, implement it in each provider, and call it through `databaseManager`. See `updateUser()` as the canonical example.

### 4. Dynamic Configuration-Driven Forms
- Forms are dynamically constructed from year-specific JSON configurations in `config/years/` (e.g., `FRC-2025.json`, `FRC-2026.json`, `FTC-2026.json`).
- Game configurations define scoring categories (autonomous, teleop, endgame), field types, point multipliers, and field layout drawings.
- Loaded through `config/game-config-loader.ts` and consumed via the `useCurrentGameConfig` hook.

### 5. Offline-First & PWA Infrastructure
- **Service Worker**: Managed via Serwist (`src/app/sw.ts`, `src/app/serwist/`) with custom runtime caching strategies (`runtimeCaching.ts`).
- **IndexedDB**: Dexie.js for client-side local persistence (`src/lib/indexeddb-service.ts`).
- **Offline Queue Manager**: `src/lib/offline-queue-manager.ts` queues submissions (match scouting, pit scouting, notes) when offline and syncs them when reconnected.
- **Event Cache Manager**: `src/lib/event-cache-manager.ts` pre-fetches and caches event schedules, team rosters, and configs for zero-connectivity venues.

### 6. Analytics & Strategy Engine
- **Statistics & EPA**: `src/lib/statistics.ts` computes Expected Points Added (EPA), Scout Performance Ratings (SPR), contribution breakdowns, and team ranking metrics.
- **Picklists**: Dynamic, weighted picklist builder with custom metric formulas and drag-and-drop reordering (`src/hooks/use-picklist.tsx`).
- **Matchup & Simulation**: Real-time alliance match prediction and scouting schedule distribution.

### 7. Push Notifications
- Web Push API integration (`web-push`, `src/lib/notifications.ts`, `src/hooks/use-notifications.ts`) for scouting shift assignments and match alerts.

---

## Key Patterns & Conventions

### 1. Database Service Access
**Never instantiate database classes directly and never write SQL outside `src/db/`.** Always retrieve the active service from the singleton `databaseManager`, and always operate through named methods on `DatabaseService`:

```typescript
import { databaseManager } from "@/db/database-manager";

const service = databaseManager.getService();
const matchEntries = await service.getAllMatchEntries(year, eventCode, competitionType);
```

For API routes, use the shared helper instead of repeating the lazy-init pattern:

```typescript
import { getDbService } from "@/lib/server/db-service";

const service = getDbService();
```

**Adding new database operations:**
1. Add the method signature to `DatabaseService` in `src/lib/types/db/service.ts`
2. Implement it in each provider under `src/db/`
3. Add a convenience pass-through on `DatabaseManager` if needed
4. Call it from routes/services — no raw SQL in callers

### 2. API Route Auth Guards
Use the shared helpers in `src/lib/server/require-permission.ts` instead of repeating the session check inline:

```typescript
import { requirePermission, requirePermissionWithSession } from "@/lib/server/require-permission";
import { PERMISSIONS } from "@/lib/auth/roles";

// Simple guard — just blocks if denied
export async function GET() {
  const denied = await requirePermission(PERMISSIONS.VIEW_MATCH_SCOUTING);
  if (denied) return denied;
  // ...
}

// When you also need the session object after the check
export async function POST(request: NextRequest) {
  const result = await requirePermissionWithSession(PERMISSIONS.CREATE_MATCH_SCOUTING);
  if (result.denied) return result.denied;
  const { session } = result;
  // session.user.id, session.user.role are typed and available
}
```

Available helpers:
- `requirePermission(permission)` — checks a single permission
- `requireAnyPermission(permissions[])` — checks at least one of several permissions
- `requirePermissionWithSession(permission)` — returns typed session on success
- `requireAuth()` — checks any valid session (no specific permission needed)

### 3. Year-Based Configuration System
When accessing scoring metrics or game-specific fields, consume the configuration hooks:

```typescript
import { useCurrentGameConfig } from "@/hooks/use-game-config";

const { currentYear, currentProgram, getCurrentYearConfig } = useCurrentGameConfig();
const yearConfig = getCurrentYearConfig(); // Returns YearConfig for active game year
```

### 4. Dynamic Form Construction
Dynamic forms (`dynamic-match-scout-form.tsx`, `dynamic-pit-scout-form.tsx`) map config definitions to UI components:
- `boolean` → `Checkbox` / `Switch`
- `counter` / `number` → Increment/decrement stepper with point multipliers
- `select` / `enum` → `Select` dropdown or `RadioGroup`
- `canvas` / `drawing` → `FieldDrawingCanvas` interactive field mapper

### 5. Custom Hook Patterns
Place reusable stateful logic under `src/hooks/` following the naming convention `use-[feature]-[data]`:
- `useEventTeams` - Loads and caches teams for the active event
- `usePicklistData` - Aggregates stats for picklist creation
- `useDashboardStats` - Computes team-wide summary metrics
- `useOffline` - Monitors network status and sync queue

### 6. API Route Structure
API routes reside in `src/app/api/` and follow standard RESTful conventions with uniform JSON responses:

```typescript
// Example: src/app/api/scouting/entries/match/route.ts
import { NextResponse } from "next/server";
import { getDbService } from "@/lib/server/db-service";
import { requirePermission } from "@/lib/server/require-permission";
import { PERMISSIONS } from "@/lib/auth/roles";

export async function GET(request: Request) {
  const denied = await requirePermission(PERMISSIONS.VIEW_MATCH_SCOUTING);
  if (denied) return denied;

  try {
    const service = getDbService();
    const data = await service.getAllMatchEntries();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch match entries:", error);
    return NextResponse.json({ error: "Failed to fetch match entries" }, { status: 500 });
  }
}
```

### 7. Component Directory Structure
- `src/components/ui/` - Atomic UI building blocks (Radix wrappers, buttons, inputs, dialogs)
- `src/components/forms/` - Scouting forms, dynamic fields, drawing canvases, login/search forms
- `src/components/charts/` - Statistical charts, EPA progressions, radar charts
- `src/components/team-pages/` - Dedicated team profile tabs, overview widgets, and galleries
- `src/components/tables/` - Sortable/filterable data tables (TanStack Table)
- `src/components/sync/` - Sync status badges, offline banners, and queue viewers

### 8. Multi-Theme System
Themes are declared in `src/app/themes/*.css` using OKLCH color tokens and imported in `src/app/globals.css`. Metadata is registered in `src/lib/theme-config.ts`.
- Supported theme names: `green` (default), `blue`, `purple`, `rose`, `orange`
- Color tokens include: `--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--border`, `--chart-1` through `--chart-5`, etc.

---

## Roles & Permissions

Roles and permissions are defined in `src/lib/auth/roles.ts`. The system uses explicit permission lists per role — there is no inheritance.

### Roles (least → most privileged)
| Role | Description |
|---|---|
| `external` | Very limited read-only access for visiting teams. No comments (GP policy). |
| `viewer` | Read-only access to all scouting data and analytics. |
| `tablet` | Field tablet accounts. Can scout and submit on behalf of other users via `SCOUT_ON_BEHALF`. |
| `scout` | Can create/edit their own match and pit entries. |
| `lead_scout` | Full scouting access including delete, event config, data export, and override rights. |
| `admin` | Full access to everything including user management and system settings. |

### Key Permission Notes
- **`VIEW_COMMENTS`**: Intentionally excluded from `external` role. External users should not see comments due to gracious professionalism (GP) policy.
- **`SCOUT_ON_BEHALF`**: Exclusive to `tablet` role. Allows submitting a scouting entry attributed to a different user (`scoutingForUserId` in the request body).
- **`OVERRIDE_MATCH_SCOUTING` / `OVERRIDE_PIT_SCOUTING`**: Granted to `lead_scout` and `admin`. Allows editing or managing entries that belong to other users. These are intentionally separate from the `DELETE_*` permissions — do not conflate them.
- **`MANAGE_SYSTEM_CONFIG`**: Admin-only. Guards system settings and API key management.

---

## Offline Queue Flow

The offline system works in three layers:

```
User submits entry (scout form)
        │
        ▼
  network available?
    ├─ YES → POST /api/scouting/entries/match (or pit)
    │         ├─ success → done
    │         └─ network error/timeout → fall through to queue
    └─ NO  → IndexedDB (Dexie) via indexedDBService
              └─ entry stored as OfflineQueueEntry with status "pending"
                        │
                        ▼
              Service Worker background sync
              OR app comes back online (useOffline hook)
                        │
                        ▼
              offlineQueueManager.syncPendingEntries()
                        │
                        ├─ POST each entry to API
                        │   ├─ success → mark "synced", remove from queue
                        │   └─ failure → mark "failed", increment retryCount
                        │
                        └─ retryFailedEntries() on next sync cycle
```

**Key files:**
- `src/lib/indexeddb-service.ts` — Dexie schema, queue read/write operations
- `src/lib/offline-queue-manager.ts` — sync logic, retry with backoff, batch processing
- `src/lib/event-cache-manager.ts` — pre-fetches event data (teams, schedule, configs) before going offline
- `src/app/sw.ts` — service worker: handles `sync` events, triggers `syncOfflineData()` and `retryFailedEntries()`
- `src/hooks/use-offline.ts` — client hook: monitors `navigator.onLine`, exposes queue status and manual sync trigger
- `src/components/sync/` — UI: sync status badge, offline banner, queue viewer, precache progress

**Rules when modifying data submission:**
- Any new form submission must go through `indexedDBService` when offline — do not add API-only submission paths
- Match entries, pit entries, and notes all have dedicated queue types in `OfflineQueueEntry`
- The service worker `sync` tag is `offline-data` — register it via `REGISTER_SYNC` message, not directly

---

## Event Proxy Routes (Intentionally Public)

The following routes under `/api/events/[eventCode]/` proxy data from TBA and FTC Events APIs and are **intentionally unauthenticated**:

- `GET /api/events/[eventCode]/teams`
- `GET /api/events/[eventCode]/matches`
- `GET /api/events/[eventCode]/schedule`
- `GET /api/events/[eventCode]/rankings`
- `GET /api/events/[eventCode]/colors`

These serve read-only public competition data. The API keys (TBA, FTC Events) are consumed server-side and are never exposed to the client. If you add a new event proxy route, maintain this pattern — no auth guard, server-side key consumption only.

---

## Environment Variables

This application is designed to run as a Docker container. All configuration is supplied via environment variables — **no code changes should be required to deploy**. See `.env.example` at the repo root for the full documented list.

### Required for operation
| Variable | Purpose |
|---|---|
| `NEXTAUTH_URL` | Canonical public URL (e.g. `https://scouting.yourteam.com`) |
| One of the database provider groups | See `.env.example` for Azure SQL / MariaDB / Cosmos / Firebase |

### Auto-generated if absent
| Variable | Behavior |
|---|---|
| `NEXTAUTH_SECRET` | Auto-generated on first start and persisted to `.runtime/auth-secret.json`. Set explicitly for multi-replica deployments. |

### Optional features
| Variable | Feature |
|---|---|
| `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_CONTACT_EMAIL` | Push notifications |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Must match `VAPID_PUBLIC_KEY` — used client-side for push subscription |
| `TBA_API_KEY` | FRC event data from The Blue Alliance |
| `FTC_API_KEY` | FTC event data |
| `NEXUS_API_KEY` | Pit maps and event status |
| `TBA_WEBHOOK_SECRET` | TBA match alert webhooks |

API keys can also be configured at runtime via the `/settings` UI, which persists them to `.runtime/api-keys.json`. Environment variables always take precedence over persisted values.

### Runtime persistence (`.runtime/`)
The `.runtime/` directory stores values that are configured at runtime via the web UI and should not be committed to source control (it is `.gitignore`d):
- `.runtime/auth-secret.json` — auto-generated auth secret
- `.runtime/database-config.json` — persisted database provider config from the `/setup` wizard
- `.runtime/api-keys.json` — API keys saved via the settings UI
- `.runtime/system-settings.json` — system settings (signup enabled, etc.)

---

## Critical Developer Workflows

### Essential Commands

| Command | Purpose |
| :--- | :--- |
| `pnpm dev` | Start development server with Turbopack |
| `pnpm build` | Production build (always run to validate TypeScript & routes) |
| `pnpm start` | Start production server locally |
| `pnpm lint` | Run ESLint across codebase |
| `pnpm test` | Run unit tests via Vitest |
| `pnpm test:integration` | Run integration tests via Vitest |
| `pnpm test:e2e` | Run end-to-end tests via Playwright |

### Adding a New Game Year

1. Add configuration file `config/years/<PROGRAM>-<YEAR>.json` (e.g., `FRC-2027.json`).
2. Register and import the JSON in `config/game-config-loader.ts`.
3. Verify scoring fields, point weights, and field canvas coordinates.
4. Ensure year appears in the year switcher component (`src/components/navigation/year-selector.tsx` or related).
5. Run `pnpm build` and verify form rendering in `/scout/match` and `/scout/pit`.

### Adding or Modifying a Database Provider

1. Add the new method signature to `DatabaseService` in `src/lib/types/db/service.ts`.
2. Implement it in each provider under `src/db/` — all four providers must implement every interface method.
3. Add a convenience pass-through on `DatabaseManager` (`src/db/database-manager.ts`) if the method is called from outside `src/db/`.
4. Update `.env.example` with any new environment variables.
5. Add setup fields in `src/components/database-provider-fields.tsx` if the provider has configurable options.

### Adding a New Permission

1. Add the constant to `PERMISSIONS` in `src/lib/auth/roles.ts`.
2. Assign it to the appropriate roles in `ROLE_PERMISSIONS`.
3. Use it in the relevant API route via `requirePermission(PERMISSIONS.YOUR_NEW_PERMISSION)`.
4. Document the purpose in a comment — especially note any non-obvious role exclusions (see `VIEW_COMMENTS` pattern).

---

## Coding Best Practices

1. **Always Validate Builds**: Run `pnpm build` after non-trivial changes to catch typing or App Router issues.
2. **Preserve Offline Fallbacks**: Any feature modifying data submission must handle offline state via `indexedDBService` and `offlineQueueManager`.
3. **Strict Typing**: Maintain comprehensive type definitions in `src/lib/types/`. Avoid `any`.
4. **Theme Compatibility**: Use semantic CSS variable classes (`bg-background`, `text-foreground`, `text-primary`, `border-border`) rather than hardcoded hex colors.
5. **No SQL Outside `src/db/`**: All database operations belong behind the `DatabaseService` interface. Callers describe *what* they want; providers decide *how* to do it.
6. **No Hardcoded Config**: Anything that might differ between deployments (URLs, emails, keys, secrets) must come from an environment variable. Refer to `.env.example` for the full list.
