# Publication checklist

Release preparation does not automatically publish the repository or deploy the app.
Record evidence against the exact release commit and tag; local working-tree results
are not a substitute for CI on that commit.

## Repository publication

- [ ] Review all staged and untracked files; commit only intended changes.
- [ ] Scan all Git refs/history with a secret scanner and review redacted findings.
      Also scan the working tree and final container/standalone artifact. Rotate
      exposed credentials before publication; coordinate any required history rewrite.
- [ ] Run the production dependency audit and resolve or document each advisory.
- [ ] Enable GitHub secret scanning/push protection, private vulnerability reporting,
      dependency alerts and branch protection requiring CI. Verify these in repository
      settings; adding workflow files does not enable every setting.
- [ ] Confirm the intended GPLv3 grant and copyright ownership with contributors.
      Review redistribution permissions and attribution for team logos, the field
      image, screenshots, fonts and dependencies. Do not assume the root software
      license establishes rights to third-party trademarks or artwork.
- [ ] Replace identifiable/private screenshots with approved or synthetic data.
- [ ] Verify the README from a fresh clone on another machine.
- [ ] Tag a reviewed release and publish changelog notes and known limitations.

## Deployment acceptance

- [ ] Run lint, typecheck, unit/API tests, browser tests and both SQL provider jobs.
- [ ] Verify fresh Docker build/start as the non-root user with runtime-only secrets.
      Confirm no secret or `.runtime` data was included in the image.
- [ ] With a real isolated database, exercise setup, login, password change, old/new
      password verification, scouting save/read and restart. Browser tests with
      intercepted API calls do not establish this full end-to-end behavior.
- [ ] Test missing/wrong setup tokens and concurrent first-admin requests in staging.
- [ ] Save, rename and delete a season; restart and replace the container; confirm
      forms, analytics and import validation use the same persistent configuration.
- [ ] Verify logout/user switching, guest expiry/revocation, permission demotion and
      session expiry offline. Ensure cached private data cannot cross users and
      queued submissions retain ownership. This remains a release gate for shared devices.
- [ ] Test iOS/Safari and Android/Chrome installation, offline reload, reconnection,
      keyboard navigation and touch form usability.
- [ ] Configure HTTPS, trusted proxy headers, edge request limits and monitoring.
- [ ] Restore database and runtime backups to an isolated instance, then rehearse
      rollback without overwriting newer competition data.
- [ ] Configure production secrets/storage, disable setup after initialization, and
      document signup policy, account recovery, privacy, retention and data deletion.

## Known support limits

- One application instance with persistent runtime storage; independent replicas
  and ephemeral/serverless filesystems are not currently supported.
- Firestore/Cosmos tests simulate SDKs; validate actual cloud persistence separately.
- `/api/health` is liveness only. External monitoring must also verify dependencies.
- No self-service password recovery or dedicated privacy-policy page is provided.
- Asset permissions, GitHub settings, production backups and operational ownership
  require verification by the repository/deployment owner.

## Current preparation evidence (2026-10-27)

- Local verification passed: 308 unit/API tests, 32 browser tests against the
  production build, typecheck, and lint (two TanStack/React Compiler warnings).
  The standalone artifact check passed with a build-time secret sentinel and
  confirmed runtime state was excluded. Docker and deployment builds also run
  this check; Docker execution itself remains unverified locally.
- Gitleaks 8.30.1 scanned 317 commits across locally available refs and a source
  snapshot of tracked/untracked non-ignored files. No credential findings remained.
  Forty historical generic-key findings were reviewed: all were four exact
  `teleop.L1_coral` through `teleop.L4_coral` scoring references in FRC-2025.json.
  `.gitleaks.toml` allowlists only those values in that file. This is a scanner
  result, not a guarantee that every possible secret format was detected.
- Production dependency audit fell from 14 advisories to one high advisory after
  updating Next.js, Zod and source-map-js. The remaining Azure authentication
  dependency finding is described below and still requires resolution or review.
- Docker Desktop's engine was not running during the local review. SQL service
  jobs and Docker deployment acceptance must run before release.

### Azure authentication dependency advisory

`@azure/identity` currently brings in `@azure/msal-node` 6.x. The upstream fix
for [GHSA-xcx6-jx8p-x3h5](https://github.com/advisories/GHSA-xcx6-jx8p-x3h5)
is MSAL Node 7.1.0, outside Azure Identity 4.14.0's declared `^6.0.0` range.
Athena uses `DefaultAzureCredential`; no `acquireTokenByCode` call was found in
application source. The advisory concerns the authorization-code flow. This
reduces apparent applicability but is not proof of safety for every credential
chain or deployment. Do not force an untested major-version override. Recheck
Azure's supported dependency update, or perform and document a deployment-specific
risk review before release. The security workflow reports all findings and blocks
critical advisories; it does not automatically approve outstanding high findings.
