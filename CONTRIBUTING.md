---
title: "Contributing to openJII"
date: 2026-07-23
generated_by: skills-for-architects
---

# Contributing to openJII

[![License](https://img.shields.io/github/license/Jan-IngenHousz-Institute/open-jii)](https://github.com/Jan-IngenHousz-Institute/open-jii/blob/main/LICENSE)

Thank you for your interest in contributing! This document covers how to report issues, set up a development environment, and get changes merged.

## Reporting issues

### Bugs

- **Do not open a GitHub issue if the bug is a security vulnerability.** Please follow our [security policy](https://github.com/Jan-IngenHousz-Institute/open-jii/security) instead.
- **Search [existing issues](https://github.com/Jan-IngenHousz-Institute/open-jii/issues) first** to avoid duplicates.
- If none exists, [open a new issue](https://github.com/Jan-IngenHousz-Institute/open-jii/issues/new) with a clear title, steps to reproduce, expected vs actual behavior, and your environment.

### Features

- Open an issue to discuss the feature before writing code. Explain the use case and the problem you're solving, and wait for feedback from the core team before starting development.

## Development setup

Prerequisites: Node.js v24+ (`.nvmrc`), pnpm 11 via corepack, Docker, and [uv](https://docs.astral.sh/uv/) if you work on `apps/data`.

```bash
git clone https://github.com/Jan-IngenHousz-Institute/open-jii.git
cd open-jii
nvm use
corepack enable
pnpm install

pnpm db:setup     # first-time setup: start Postgres, reset + migrate the DB (wipes local data)
pnpm dev:fb       # run web + backend (or `pnpm dev` for everything)
```

This is a pnpm + Turborepo monorepo — see the [README](README.md#monorepo-layout) for the app/package layout. To work on a single app, use turbo filters, e.g. `pnpm --filter web dev` or `pnpm --filter backend test`.

## Making changes

1. Create a branch from `main`.
2. Make your changes, including tests for new functionality.
3. Verify locally:

   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm format
   ```

4. Commit using **Conventional Commits** — releases are automated with semantic-release, so commit messages matter:

   - `feat(web): add experiment archive filter`
   - `fix(backend): reject expired API keys`
   - `docs: update contributing guide`

   Common scopes are the app or package name (`web`, `backend`, `mobile`, `data`, `docs`, `ui`, ...).

5. Open a pull request against `main`. Describe the problem and the solution, and link the relevant issue if there is one. CI must pass before review.

## Documentation contributions

Documentation improvements are always welcome:

- The documentation site lives in `apps/docs` (Fumadocs on Next.js); researcher-facing content is under `apps/docs/content/guide`, developer content under `apps/docs/content/developers`.
- Run it locally with `pnpm --filter docs dev`.
- Keep the existing style and tone, and check that links and screenshots still match the current UI.

## Questions?

Open a GitHub issue for bugs or feature discussions, or reach out to the maintainers for anything else.

Thank you for contributing to openJII! ❤️
