# Real SQL persistence tests

Run `pnpm test:database` against an isolated MariaDB or SQL Server instance. These tests use the actual adapters and drivers, without mocked database calls. SQL Server exercises the Azure SQL adapter's SQL dialect and password authentication; it does not exercise Azure managed identity or the cloud service itself. Firebase and Cosmos continue to use the existing adapter tests with simulated SDKs.

Each run creates a randomly named `athena_test_<uuid>` database on `127.0.0.1`, initializes the application's schema, and drops that database afterward. The suite never reads application database settings. It requires an explicit test password and a local `root` (MariaDB) or `sa` (SQL Server) account with permission to create databases.

Coverage includes pit and match create/read/update/delete, JSON arrays and nested data, Unicode notes, timestamps, concurrent duplicate prevention, event/year/competition isolation, export/import with editable IDs, concurrent username reservation, password updates, and account activation/session versions.

For MariaDB, start an isolated container:

```sh
docker run --detach --rm --name athena-test-mariadb -p 127.0.0.1:13306:3306 -e MARIADB_ROOT_PASSWORD=Athena-test-only-123! -e MARIADB_ROOT_HOST=% mariadb:11.4
```

Then run in PowerShell:

```powershell
$env:TEST_DATABASE_PROVIDER = 'mariadb'
$env:TEST_DATABASE_PORT = '13306'
$env:TEST_DATABASE_PASSWORD = 'Athena-test-only-123!'
pnpm test:database
```

For SQL Server, start:

```sh
docker run --detach --rm --name athena-test-sqlserver -p 127.0.0.1:11433:1433 -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD=Athena-test-only-123! mcr.microsoft.com/mssql/server:2022-latest
```

Then use `TEST_DATABASE_PROVIDER=azuresql` and `TEST_DATABASE_PORT=11433` with the same test password. The suite waits up to 90 seconds for the database to accept connections. On POSIX shells, the variables can be supplied inline:

```sh
TEST_DATABASE_PROVIDER=azuresql TEST_DATABASE_PORT=11433 TEST_DATABASE_PASSWORD='Athena-test-only-123!' pnpm test:database
```

Stop the test containers when finished:

```sh
docker stop athena-test-mariadb athena-test-sqlserver
```

These tests are separate from `pnpm test` and `pnpm test:integration`, so neither needs a database. CI runs both SQL providers in disposable service containers through `.github/workflows/database.yml`; failures block deployment along with unit and browser tests. No production credentials or cloud resources are required.
