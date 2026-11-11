# Deploying Athena

For the recommended prebuilt image and browser setup wizard, start with
[Install with Docker](docker-install.md). This guide covers advanced hosting.

## Supported topology

Run one Node.js 22 application instance behind an HTTPS reverse proxy, with a
persistent writable `.runtime` directory and a separately provisioned database.
MariaDB/MySQL, Azure SQL/SQL Server, Firestore and Cosmos DB are supported adapters.
SQL providers have real-database CI coverage; document providers currently have
simulated SDK tests. Validate the chosen cloud provider in staging before launch.

Do not scale to independent replicas yet: settings, setup locks and game overrides
use the local filesystem, and rate limits use process memory. The offline queue
is intended for trusted team devices. Shared-device cache isolation still needs
the review listed in the release checklist.

## Editing game configuration

Open **Settings → Game Configuration**, select the season, edit the visual
builder, and choose **Save Config**. The editor loads the saved server version
and shows whether changes are unsaved. In the JSON dialog, choose **Apply JSON
to editor**, then **Save Config** to publish.

Saved changes refresh the current tab and other online tabs. Other devices
check on navigation, focus, reconnection, and every 30 seconds while visible.
Scouting forms retain entered values when the same season's configuration
changes. Offline sessions keep their last loaded configuration until reconnecting.

Overrides live in `.runtime/configs`, so the persistent `.runtime` volume is
required to keep GUI changes across deployments. Bundled `config/years` files
are defaults; an existing runtime override takes precedence.

## Secrets and initial setup

1. Generate two independent random values with
   `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`.
2. Supply one as runtime `AUTH_SECRET` and the other as `SETUP_TOKEN`. Set
   `NEXTAUTH_URL` to the browser-facing HTTPS origin. Never use test secrets.
3. Mount `.runtime` persistently and grant the application user access. Docker's
   application user has UID/GID 1001; a host bind mount must be writable by it.
4. Visit `/setup`, enter the setup token, configure the URL and database, then
   create the first administrator. Setup endpoints require the token. Database
   changes after initialization require the logged-in database administrator.
5. Remove `SETUP_TOKEN` and restart after initialization. Public signup defaults
   to disabled; create accounts as an administrator or explicitly enable signup.

In development, absent secrets are generated in `.runtime/auth-secret.json` and
`.runtime/setup-token.json`. These files are private. Direct Node deployments never fall back
to generated development secrets. The Docker bootstrap explicitly provisions
production secrets into its persistent volume before starting Node. `AUTH_SECRET` takes precedence over the legacy
`NEXTAUTH_SECRET` alias. The auth secret must be stable across restarts; rotating
it invalidates existing sessions and signed guest links.

Setup changes are serialized with `.runtime/setup.lock`. After a crash during
setup, stop **all** application processes before removing this empty lock directory
and retrying. Never remove it while setup requests might still be running.

## Build and run

`pnpm install --frozen-lockfile` and `pnpm build` do not need production secrets.
For standalone deployments, package `.next/standalone`, `.next/static`, `public`
and `config` in the same layout used by the Dockerfile and Azure workflow. Run
`node server.js` from the standalone package with runtime environment variables.
Do not distribute `.runtime`, `.env` files, test reports or database backups.
Public `NEXT_PUBLIC_*` branding values are build-time settings.

The supplied Compose file pulls a prebuilt application image, generates signing/setup
secrets, and provisions a named runtime volume automatically. Connect your database
through the existing setup wizard. It binds the app to
localhost; HTTPS termination is supplied by the operator. See the Docker guide
for first-run commands and migration cautions.

The existing Azure workflow targets this project's deployment. Fork maintainers
must configure their own OIDC credentials, application name and durable storage
before enabling deployment. On platforms with ephemeral application directories,
mount persistent storage at the application's `.runtime` path. A successful deploy
is not proof that this directory survives replacement: test it.

## Upgrade from build-time secrets and writable bundled configuration

Before upgrading, back up the database, `.runtime`, and any edited files under
`config/years`. Copy custom season JSON into `.runtime/configs` using names such as
`FRC-2026.json`. Runtime overrides take precedence over bundled defaults. Deleting
a season records a persistent tombstone; saving it again restores it. Game Config
Studio refreshes the current page after a save; other devices need to refresh or
recache their offline pages to receive changes.

Explicitly set a new production runtime auth secret before starting this version.
Plan for users to sign in again and recreate guest links. Do not distribute an old
container image containing the previous embedded signing secret.

## Proxy, monitoring and recovery

- Terminate HTTPS at the reverse proxy. Overwrite forwarded host/protocol headers;
  restrict direct access to port 3000. Set `RATE_LIMIT_IP_HEADER` only to a header
  the proxy overwrites (for example `x-real-ip`). Otherwise all clients share one
  conservative authentication rate-limit bucket. Add edge limits for traffic spikes.
- Apply proxy request-body limits and timeouts suitable for your CSV/image imports.
- `GET /api/health` reports process liveness without exposing configuration. It
  does not test database readiness. Monitor a staging/test account's login and
  scouting save/read cycle separately, plus application errors and disk capacity.
- Back up both the database and `.runtime` to access-controlled storage. The latter
  can contain API keys and database credentials. Define retention, restore ownership
  and permissions, and perform a restore into an isolated deployment before launch.
- Keep the previous immutable release and a matching backup. Before rollback,
  check schema compatibility; never blindly restore over newer competition data.
- Password recovery currently requires an administrator to update the account.
  Maintain a recovery operator and an access-controlled procedure for a lost admin.
- For a hosted service, document what account/scouting data and browser caches you
  retain, who can access it, and how users request export or deletion.
