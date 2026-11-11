# Browser regression tests

Run `pnpm test:e2e` after installing Chromium with `pnpm exec playwright install chromium`.
Playwright builds the production application and starts its standalone server on port 3100. Set `E2E_PORT` to use another port.
It deliberately does not reuse a running application: the server needs the isolated test auth secret.
The standalone package includes the same public assets and game configuration as deployment. Rebuilds happen automatically for every run.

The scouting suite uses real pages, providers, UI controls, submission code, and the current server Zod schemas. Browser requests simulate sessions, event data, duplicate checks, and database writes. No competition database credentials or live event services are needed. This catches incompatibilities between form payloads and validators, but does not test database persistence or actual login credentials; API and database tests cover those layers separately.

Coverage includes pit and match creation across every bundled season, strict updates, optional pit dimensions, multiselect arrays, duplicate prevention, rejected submissions and retry, offline IndexedDB saving, match schedule team assignment, match advancement, confirmed form clearing, and signed-out access protection. Existing tests also cover cache upgrades and the public landing page.

`account-password.spec.ts` covers the eight-character password boundary, confirmation mismatch, rejection and retry, request payloads, and clearing credentials after success. API tests separately exercise the real password route and bcrypt.

`offline-recovery.spec.ts` enables the real service worker, caches authenticated scouting pages, saves both entry types while offline, reloads offline, and verifies that reconnection uploads each queued entry once with its remote ID. It dispatches Background Sync through Chromium's DevTools protocol to avoid depending on the browser's discretionary scheduling. A second sync must complete without uploading the entry again, and worker errors fail the test. The remaining suites block service workers to keep their request mocks isolated.

When adding a season, add it to the season matrix in `scouting.spec.ts`. Never replace schema checks with a hardcoded successful response: these checks are the protection against validator regressions.

Failure screenshots and traces are in `test-results`. Open a trace with `pnpm exec playwright show-trace <trace.zip>`.

The reusable CI workflow runs this suite on pull requests and before deployment; a failed browser test prevents the deployment build from starting.
