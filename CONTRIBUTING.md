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

### Linear access for your coding agent

Optional, and only for maintainers with a Linear seat. It lets your agent read and write `OJD`
tickets: look one up, refine it, write the testing criteria before review, sweep the backlog. The
repo works without it, and the `linear:*` commands say so rather than guessing.

Mint a personal key at [Security and access](https://linear.app/settings/account/security). Scope
it to **Read plus Write** and restrict it to team **OJD**. Do not create a full-access key.

Store it without pasting it anywhere visible. Copy the key, then:

```bash
pbpaste | pnpm linear:auth          # macOS Keychain, or secret-tool on Linux
pbpaste | pnpm linear:auth --file   # fallback: .claude/.env, owner-only, gitignored
```

The command checks the key against Linear before storing it and prints whose it is. It never echoes
the key. To rotate, regenerate in Linear and run it again. Check it works:

```bash
pnpm linear:query --query '{ viewer { name } }'
```

The key is yours, not the team's: everything it writes is attributed to you. Never share it, never
paste it into a ticket, a PR or a chat, and never put it in a command line. Everything else goes
through `pnpm linear:query`, which refuses deletes and archives unless you ask for them explicitly
and logs every write to `.claude/linear-writes.log`.

Your agent picks up the rest from `AGENTS.md`: what a ticket contains, the labels, and the five
`openjii-*` skills for designing a project, refining a ticket, writing testing criteria and
triaging the backlog.

### When the agent refuses a command

`.claude/settings.json` and `.claude/hooks/protect-secrets.sh` stop an agent reading secrets into
its context or publishing a release. Expect a refusal if you ask it to read a `.env`, print a
token, dump the environment, search the keychain, or run `eas update`. That is working as intended
and the message says what to do instead: the tool that needs a secret reads it itself.

These rules are repo-wide and cannot be relaxed in your own settings, so if one blocks something
legitimate, that is a bug worth reporting rather than a local workaround. Run those commands in
your own terminal in the meantime.

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
