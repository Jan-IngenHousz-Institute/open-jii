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

Local development commands that need a credential (a dev session, Linear access) live in
`tooling/devkit`. See [its README](tooling/devkit/README.md) for the one-time setup.

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

5. Open a pull request against `main`. Describe the problem and the solution, and follow the release metadata contract below. CI must pass before review.

## Review standards

Lint, types and tests catch the mechanical mistakes. These are the judgement calls a reviewer checks:

- A fix lives in the narrowest layer that owns the problem. When a bug fix spreads across many files, the reviewer asks for the smaller option first.
- Extend an existing endpoint, hook or component before adding a parallel one.
- Class names compose with `cn()` and variants with `cva`, not template strings.
- App and pipeline code does not branch on dev versus prod. Environment differences live in configuration.
- An effect does not copy props into state or force a refresh; derive the value instead. The React lint rules fail on the common shapes.
- Postgres sets `updatedAt` through the `timestamps` helper in `packages/database/src/postgres/schema.ts`, so app code never passes it.
- A new datastore, cloud service, dependency family or large vendored drop is agreed with the team before it lands.

## Pull request and release metadata

GitHub squash merges use the pull request title as the commit subject on `main`. That subject drives semantic-release versioning, so every human-authored PR must use this format:

```text
<type>(<optional-scope>): <description>
```

For example:

```text
feat(web): add experiment archive filter
fix(backend): reject expired API keys
```

Keep the title concise and clear, ideally within 72 characters. It becomes the commit subject on `main` and a line in the release notes, so name the change and leave the detail to the description.

Use one of the Conventional Commit types configured in [`.releaserc.js`](.releaserc.js): `feat`, `fix`, `perf`, `revert`, `docs`, `style`, `chore`, `refactor`, `test`, `build`, or `ci`.

In the PR body's **Linear issues** section, add one relation line for every issue represented by the PR:

```text
Closes OJD-1541
Contributes to OJD-1602
```

- Use `Closes` when merging the PR completes the issue.
- Use `Contributes to` when the PR is only part of the issue and should not close it.
- Put each issue on its own line. These magic-word relations attach the PR to every Linear issue. The release workflow reads the merged PR number from the squash commit and adds the linked issues to the release.
- A Linear-generated branch name is encouraged, but it does not replace the relation lines in the body.
- For work that genuinely has no Linear issue, add the `no-linear` label and explain why in **Additional Notes**. Dependency update PRs and bot-authored PRs are exempt automatically.

Before requesting review, confirm the `Linear ref check` passes. It validates the Conventional Commit title and, unless exempt, the body relations.

## Documentation contributions

Documentation improvements are always welcome:

- The documentation site lives in `apps/docs` (Fumadocs on Next.js); researcher-facing content is under `apps/docs/content/guide`, developer content under `apps/docs/content/developers`.
- Run it locally with `pnpm --filter docs dev`.
- Keep the existing style and tone, and check that links and screenshots still match the current UI.

## Questions?

Open a GitHub issue for bugs or feature discussions, or reach out to the maintainers for anything else.

Thank you for contributing to openJII! ❤️
