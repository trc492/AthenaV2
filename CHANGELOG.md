# Changelog

## Unreleased

- Authentication secrets are read at runtime. Production requires an explicit
  secret; builds and distributable artifacts must not contain deployment secrets.
- Initial setup requires a deployment token and serializes setup mutations.
- New installations disable public signup by default. Authentication rate limiting
  trusts only an explicitly configured proxy header; password changes are throttled.
- Game Config Studio persists overrides and deletions in `.runtime/configs`.
  Forms, analytics and import validation read the same configuration at runtime.
- Added a liveness endpoint, release artifact checks, secret scanning, dependency
  monitoring, and contributor/deployment/security documentation.

### Upgrade action

Set runtime `AUTH_SECRET` before deploying, persist `.runtime`, and migrate any
custom files previously edited under `config/years` into `.runtime/configs`.
Review `docs/deployment.md` and `docs/release-checklist.md`; these changes alone
do not establish that a deployment is ready for public use.
