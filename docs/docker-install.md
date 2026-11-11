# Install Athena with Docker

You need Docker Engine with Compose v2 (or Docker Desktop using Linux containers).
No source checkout, Node.js installation, or application code changes are needed.
The initial published image targets Linux x86-64; ARM is not yet validated.

The image publishing workflow is prepared, but the first public image has not yet
been published. The commands below become usable after that release is available.

## First installation

1. Download `docker-compose.yml` from the
   [latest release](https://github.com/Writerfrighter/AthenaV2/releases/latest)
   into an empty folder. Keep this folder for future upgrades.
2. Open a terminal in that folder and run:

   ```sh
   docker compose up -d
   ```

   Docker downloads Athena, generates signing/setup secrets, and creates
   persistent storage for configuration. Check
   progress with `docker compose ps --all`.
3. Retrieve your private setup token:

   ```sh
   docker compose exec nextapp node -p "JSON.parse(require('fs').readFileSync('.runtime/setup-token.json','utf8')).secret"
   ```

   Keep this token private. It proves that you control this installation.
4. Open `http://localhost:3000/setup`. Enter the token, set the browser-facing URL,
   connect your database, and create your first administrator using the existing
   startup wizard. Athena creates the tables in your chosen database automatically.
   Public registration starts disabled. The database service itself must already
   exist and be reachable from the container.

For a team deployment, configure an HTTPS reverse proxy to the host's port 3000
before sharing the site, and use that HTTPS URL in setup. The default port is
bound to localhost. Remote phones cannot use their own `localhost` to reach it.
PWA/offline features require HTTPS outside localhost. Domain and certificate
configuration remain hosting tasks; they cannot be inferred by the image.

After setup, optionally create a file named `.env` alongside the Compose file:

```dotenv
ATHENA_SETUP_ENABLED=false
```

Run `docker compose up -d` to apply it. This locks the setup token endpoints;
normal authenticated administration remains available. Settings, game configuration
and user management are all handled in the browser.

## Storage and upgrades

The container uses a Docker-managed volume for application settings, database
connection details, and signing/setup secrets. Back up this volume and your
external database, and test a restore before upgrading. Keep the same Compose folder/project name so Docker
continues using the same volumes. `docker compose down` retains volumes;
`docker compose down --volumes` deletes installation data and must not be used
for an upgrade. See [Docker's volume documentation](https://docs.docker.com/reference/compose-file/volumes/).

After reviewing release notes and making a backup:

```sh
docker compose pull
docker compose up -d
docker compose ps
```

`latest` follows stable releases. For controlled updates, set `ATHENA_IMAGE` in
`.env` to a published version, for example `ghcr.io/writerfrighter/athenav2:1.0.0`
once that version exists, or to an immutable image digest. Do not assume database
schema changes support downgrading; review compatibility before rollback.

Existing source-based installations: this Compose file uses new named volumes
instead of the old `./.runtime` bind mount. Restore or
migrate your existing settings and database deliberately before switching; simply
running this file does not migrate old data.

## Running without Compose

You can also run the same image directly with a persistent runtime volume:

```sh
docker run -d --name athena --restart unless-stopped -p 127.0.0.1:3000:3000 -v athena-runtime:/app/.runtime ghcr.io/writerfrighter/athenav2:latest
docker exec athena node -p "JSON.parse(require('fs').readFileSync('.runtime/setup-token.json','utf8')).secret"
```

Enter the token and your existing database connection in the browser wizard.
Do not use this command alongside the Compose stack on the same port. Advanced
operators can supply `AUTH_SECRET`, `SETUP_TOKEN`, `NEXTAUTH_URL` and trusted proxy
settings explicitly. Supplying secrets overrides generated values; retain the
same values across replacements. See [advanced deployment](deployment.md).

## Publishing images (maintainers only)

Publish a GitHub Release with a version tag such as `v1.0.0`. The container
workflow runs the existing test workflows, builds the image, checks a fresh
Compose installation and replacement, then pushes to
`ghcr.io/writerfrighter/athenav2`. Stable releases receive a version tag and
`latest`; manual runs receive a commit tag and do not move `latest`.
It uploads this guide and the Compose file as release assets after success.

Set the GHCR package visibility to public for anonymous pulls, and verify the
installation on a clean machine before announcing it. GitHub Release publication
alone does not mean the asynchronous image workflow has succeeded. See
[GitHub's container publishing documentation](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images).
Keep corresponding source available at the release tag and retain the GPL license
included in the image. Users can run the packaged app without editing that source.
