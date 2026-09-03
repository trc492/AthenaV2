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
**Never instantiate database classes directly.** Always retrieve the active service from the singleton `databaseManager`:

```typescript
import { databaseManager } from "@/db/database-manager";

const service = databaseManager.getService();
const matchEntries = await service.getMatchEntriesByEvent(eventId);
```

### 2. Year-Based Configuration System
When accessing scoring metrics or game-specific fields, consume the configuration hooks:

```typescript
import { useCurrentGameConfig } from "@/hooks/use-game-config";

const { currentYear, currentProgram, getCurrentYearConfig } = useCurrentGameConfig();
const yearConfig = getCurrentYearConfig(); // Returns YearConfig for active game year
```

### 3. Dynamic Form Construction
Dynamic forms (`dynamic-match-scout-form.tsx`, `dynamic-pit-scout-form.tsx`) map config definitions to UI components:
- `boolean` → `Checkbox` / `Switch`
- `counter` / `number` → Increment/decrement stepper with point multipliers
- `select` / `enum` → `Select` dropdown or `RadioGroup`
- `canvas` / `drawing` → `FieldDrawingCanvas` interactive field mapper

### 4. Custom Hook Patterns
Place reusable stateful logic under `src/hooks/` following the naming convention `use-[feature]-[data]`:
- `useEventTeams` - Loads and caches teams for the active event
- `usePicklistData` - Aggregates stats for picklist creation
- `useDashboardStats` - Computes team-wide summary metrics
- `useOffline` - Monitors network status and sync queue

### 5. API Route Structure
API routes reside in `src/app/api/` and follow standard RESTful conventions with uniform JSON responses:

```typescript
// Example: src/app/api/scouting/entries/match/route.ts
import { NextResponse } from "next/server";
import { databaseManager } from "@/db/database-manager";

export async function GET(request: Request) {
  try {
    const service = databaseManager.getService();
    const data = await service.getMatchEntries();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch match entries:", error);
    return NextResponse.json({ error: "Failed to fetch match entries" }, { status: 500 });
  }
}
```

### 6. Component Directory Structure
- `src/components/ui/` - Atomic UI building blocks (Radix wrappers, buttons, inputs, dialogs)
- `src/components/forms/` - Scouting forms, dynamic fields, drawing canvases, login/search forms
- `src/components/charts/` - Statistical charts, EPA progressions, radar charts
- `src/components/team-pages/` - Dedicated team profile tabs, overview widgets, and galleries
- `src/components/tables/` - Sortable/filterable data tables (TanStack Table)
- `src/components/sync/` - Sync status badges, offline banners, and queue viewers

### 7. Multi-Theme System
Themes are declared in `src/app/themes/*.css` using OKLCH color tokens and imported in `src/app/globals.css`. Metadata is registered in `src/lib/theme-config.ts`.
- Supported theme names: `green` (default), `blue`, `purple`, `rose`, `orange`
- Color tokens include: `--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--border`, `--chart-1` through `--chart-5`, etc.

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

1. Implement or update the `DatabaseService` interface in `src/lib/types/db/index.ts`.
2. Create/update the provider class in `src/db/<provider>-database-service.ts`.
3. Register the provider in `src/db/database-manager.ts` and handle configuration resolution.
4. Add corresponding environment variables in `.env.example` and setup fields in `src/components/database-provider-fields.tsx`.

---

## Coding Best Practices

1. **Always Validate Builds**: Run `pnpm build` after non-trivial changes to catch typing or App Router issues.
2. **Preserve Offline Fallbacks**: Any feature modifying data submission must handle offline state via `indexedDBService` and `offlineQueueManager`.
3. **Strict Typing**: Maintain comprehensive type definitions in `src/lib/types/`. Avoid `any`.
4. **Theme Compatibility**: Use semantic CSS variable classes (`bg-background`, `text-foreground`, `text-primary`, `border-border`) rather than hardcoded hex colors.