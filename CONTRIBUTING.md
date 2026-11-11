# Contributing

Use Node.js 22 and the pnpm version pinned in `package.json`. Read `AGENTS.md`
and the installed Next.js guides before changing framework behavior.

1. Fork/clone the repository and run `pnpm install --frozen-lockfile`.
2. Follow the README for local configuration. Use disposable test data and keys.
3. Make a focused change. Keep API authorization on the server and preserve
   offline submissions when changing caches or service-worker behavior.
4. Run `pnpm lint`, `pnpm typecheck`, and `pnpm test`. For UI/offline changes,
   install Chromium and run `pnpm test:e2e`. Persistence changes also require the
   isolated database tests in `tests/database/README.md`.
5. Open a pull request explaining the problem, resulting behavior, validation,
   and any deployment or data-migration requirements. Include screenshots for UI
   changes and regressions tests for security or data-integrity fixes.

Do not include `.env` files, `.runtime`, real credentials, private team data,
generated builds, or identifiable screenshots in pull requests. Keep lockfile
changes intentional. Read SECURITY.md before reporting a vulnerability.

By contributing, you confirm that you have permission to submit the work under
the project's existing GPLv3 license. Be respectful and keep review discussions
focused on the work. Maintainers decide which changes enter a release.
