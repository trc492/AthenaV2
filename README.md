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
  - Supports MariaDB/MySQL, Azure SQL/SQL Server, Firebase Firestore, and Cosmos DB backends for flexible data storage.
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
  - See [theme documentation](src/app/themes/THEME_SYSTEM.md) for details.

- **Progressive Web App (PWA):**
  - Installable on devices with offline caching and background sync.

## Tech Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend/Data:** MariaDB/MySQL, Azure SQL/SQL Server, Firebase Firestore, Azure Cosmos DB; IndexedDB for offline storage
- **State Management:** React Context, custom hooks
- **Other:** Serwist for service workers, ESLint, PostCSS

## Install with Docker

Users do not need to clone the repository, install Node.js, or edit application
code. Download the release Compose file, start the prebuilt image, and finish
setup in the existing browser wizard. Choose your database, set the site URL,
and create the administrator there; the image generates its own signing secret. See [the Docker installation guide](docs/docker-install.md).

Image publication is configured but the first public image must still be released.

## Development

Use Node.js 22 and the pnpm version pinned in `package.json` (via Corepack).
Copy `.env.example` to `.env.local` and configure one database provider. Alternatively,
connect an existing database through the first-run wizard; Athena creates its tables.
No local-storage database provider is supported.

For local development, `pnpm dev` creates `.runtime/setup-token.json` if no
`SETUP_TOKEN` is configured. Read its `secret` value locally and enter it in the
wizard at `/setup`. Do not share or commit that file. Public signup is disabled
on new installations; an administrator can enable it in Settings.


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

   These route integration tests use mocked persistence. For real MariaDB and
   SQL Server persistence tests, run `pnpm test:database` with the isolated-server
   settings in [tests/database/README.md](tests/database/README.md).

6. **Run e2e tests:**

   ```sh
   pnpm exec playwright install
   pnpm test:e2e
   ```

   This builds and tests the production standalone application, including real
   service-worker offline recovery. See [e2e/README.md](e2e/README.md).

7. **Configuration:**
   - Use the Game Config Studio for deployment-specific settings. Changes persist in `.runtime/configs`; bundled defaults live in `config/years`.
   - Set up database credentials in environment variables as needed.

## Production deployment

Use [the Docker installation guide](docs/docker-install.md) for the image-based
installation and upgrades. Advanced hosting and migration notes are in
[the deployment guide](docs/deployment.md). See [the release checklist](docs/release-checklist.md)
for validation required before publication.

## Database Configuration

### Public URL in Docker

Authentication reads the public URL on each request, in this order: `AUTH_URL`,
`NEXTAUTH_URL`, then the URL saved by setup in `.runtime/app-config.json`.
Use the browser-facing origin (for example, `https://scouting.example.com`),
not the container's `0.0.0.0:3000` listening address. Saved setup URL changes
take effect without rebuilding the image. Environment changes require restarting
or recreating the container.

If no public URL is configured, authentication uses the request's host and
forwarded protocol. Reverse proxies must overwrite `X-Forwarded-Host` and
`X-Forwarded-Proto` with the public host and protocol.

Use `DATABASE_PROVIDER` to select a backend explicitly (`azuresql`, `mariadb`, `firebase`, `cosmos`). If unset, the app auto-detects based on available env vars.

### MariaDB / MySQL

- `MARIADB_CONNECTION_STRING`
- or `MARIADB_HOST`, `MARIADB_DATABASE`, `MARIADB_USER`, `MARIADB_PASSWORD`, `MARIADB_PORT`
- The equivalent `MYSQL_*` aliases are also accepted.

For local SQL Server, use the Azure SQL provider with a SQL Server connection string.

### Azure SQL

- `AZURE_SQL_CONNECTION_STRING`
- or `AZURE_SQL_SERVER`, `AZURE_SQL_DATABASE`, `AZURE_SQL_USER`, `AZURE_SQL_PASSWORD`
- `AZURE_SQL_USE_MANAGED_IDENTITY` (optional)

Database changes made from the settings UI are also saved to `.runtime/database-config.json` so Docker deployments can persist them across restarts when that path is mounted as a volume.

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

Contributions are welcome! Please open issues or pull requests for bug fixes, new features, or improvements. See [CONTRIBUTING.md](CONTRIBUTING.md) for development and pull-request guidance. Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## License

This project is licensed under the GNU General Public License v3.0

---

For more information, see the in-depth documentation in the `README.md` and the various `*_README.md` files throughout the project.
