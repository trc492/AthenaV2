This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

# AthenaV2

AthenaV2 is a modern scouting and analytics platform designed for competitive robotics teams. Built with Next.js and TypeScript, it provides a robust, extensible, and user-friendly interface for collecting, managing, and analyzing match and pit scouting data. The platform supports real-time collaboration, offline-first capabilities, and seamless integration with various data sources.

## Features

- **Event & Team Management:**
  - Switch between events and configure event-specific settings.
  - Manage team lists, view detailed team pages, and analyze team performance.

- **Scouting Forms:**
  - Dynamic match and pit scouting forms that adapt to game configuration.
  - Mobile-friendly UI for easy data entry at events.

- **Data Sync & Storage:**
  - Supports local, Firebase, and Cosmos DB backends for flexible data storage.
  - Offline support with automatic sync when connectivity is restored.

- **Analytics & Visualization:**
  - EPA (Estimated Performance Average) tables and charts.
  - Picklist generation and advanced statistics.
  - Customizable dashboards for in-depth analysis.

- **User Management:**
  - Secure login and signup flows.
  - Account settings and role-based access.

- **Customizable Themes:**
  - Multiple color themes (Green, Blue, Purple, Rose, Orange) with light/dark mode support.
  - User preference persists across sessions.
  - See [THEME_SYSTEM.md](THEME_SYSTEM.md) for details.

- **Progressive Web App (PWA):**
  - Installable on devices with offline caching and background sync.

## Tech Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend/Data:** Firebase, Azure Cosmos DB, Local Storage
- **State Management:** React Context, custom hooks
- **Other:** Workbox for service workers, ESLint, PostCSS

## Getting Started

1. **Install dependencies:**

   ```sh
   pnpm install
   ```

2. **Run the development server:**

   ```sh
   pnpm dev
   ```

   The app will be available at `http://localhost:3000`.

3. **Build for production:**

   ```sh
   pnpm build
   ```

4. **Run unit tests:**

   ```sh
   pnpm test
   ```

5. **Run integration tests:**

   ```sh
   pnpm test:integration
   ```

6. **Run e2e tests:**

   ```sh
   pnpm exec playwright install
   pnpm test:e2e
   ```

7. **Configuration:**
   - Edit `config/game-config.json` for game-specific settings.
   - Set up database credentials in environment variables as needed.

## Database Configuration

Use `DATABASE_PROVIDER` to select a backend explicitly (`azuresql`, `firebase`, `cosmos`, `local`). If unset, the app auto-detects based on available env vars.

### Local SQL (generic)

Use a local SQL Server or any SQL Server-compatible instance:

- `LOCAL_SQL_CONNECTION_STRING`
- or `LOCAL_SQL_SERVER`, `LOCAL_SQL_DATABASE`, `LOCAL_SQL_USER`, `LOCAL_SQL_PASSWORD`

### Azure SQL

- `AZURE_SQL_CONNECTION_STRING`
- or `AZURE_SQL_SERVER`, `AZURE_SQL_DATABASE`, `AZURE_SQL_USER`, `AZURE_SQL_PASSWORD`
- `AZURE_SQL_USE_MANAGED_IDENTITY` (optional)

Database changes made from the settings UI are also saved to `/.runtime/database-config.json` so Docker deployments can persist them across restarts when that path is mounted as a volume.

### Firebase

- `FIREBASE_SERVICE_ACCOUNT_PATH` (path to JSON file)
- or `FIREBASE_SERVICE_ACCOUNT_JSON` (raw JSON string)
- `FIREBASE_DATABASE_URL` (optional)

### Azure Cosmos DB

- `COSMOS_ENDPOINT`
- `COSMOS_KEY`
- `COSMOS_DATABASE_ID` (optional)
- `COSMOS_CONTAINER_ID` (optional; defaults to per-collection names)

## Project Structure

- `src/app/` — Main application pages and API routes
- `src/components/` — Reusable UI and app components
- `src/db/` — Database service abstractions
- `src/hooks/` — Custom React hooks
- `src/lib/` — Utility functions and server logic
- `public/` — Static assets and service worker
- `config/` — Game and event configuration files

## Contributing

Contributions are welcome! Please open issues or pull requests for bug fixes, new features, or improvements. See the `IMPROVEMENTS.md` for ideas and guidelines.

## License

This project is licensed under the MIT License.

---

For more information, see the in-depth documentation in the `README.md` and the various `*_README.md` files throughout the project.
