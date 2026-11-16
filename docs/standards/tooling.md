# Tooling

`tooling/*`, `turbo.json`, the root scripts and the hooks under `.claude/hooks`. The shared
configuration every workspace inherits, plus the devkit that holds the local commands needing a
credential.

## Shape

```text
tooling/eslint/            flat configs: base, nextjs, react, nest, theme-tokens
tooling/typescript-config/ base, nestjs, nextjs, react-library
tooling/tailwind/          base, web, native
tooling/vitest-config/     base, ui, setup, mobile, plus coverage aggregation
tooling/devkit/            the local commands: login, linear:*, posthog:*, grafana:*, round:read,
                           status:fixtures, analyst:prod-window, roles:*, release-cms, env:generate
tooling/release/           the dependency-aware semantic-release plugin
```

## Rules

1. A workspace that compiles TypeScript declares `check-types`, the name `turbo.json` knows and the
   name CI and `pnpm typecheck` run. A workspace without it is skipped silently. [review]
2. A lint rule that should apply everywhere goes in `tooling/eslint/base.js`. A per-app config adds
   a rule or tightens a ratchet; it does not switch a shared rule off. An exception is an explicit
   list of legacy files, kept in the config where a reader can see it shrinking. [review]
3. A root script that goes through turbo needs a task declared in `turbo.json`, or it runs with no
   dependency graph and no caching. [review]
4. A devkit command is one file with a `run` function that parses the arguments and returns an exit
   code, and exported functions that take their dependencies as parameters so a test can substitute
   them. The file ends with a guard so importing it never executes it:

   ```ts
   if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
     process.exitCode = await run(process.argv.slice(2));
   }
   ```

   [review]

5. A credential is read inside the process that needs it and never passed through a shell. The
   Linear, PostHog and Grafana keys live in an owner-only file that the devkit reads directly, which
   is why there is no command that echoes one. [review]
6. A destructive remote operation needs an explicit flag. The devkit refuses any Linear mutation
   whose name contains Delete or Archive unless told otherwise, applies a PostHog triage only with
   `--confirm`, and logs every mutation it does perform. [review]
7. Generated files are generated, not edited. `apps/backend/.env.example` and
   `apps/web/.env.example` come from the env manifest, and a test asserts the committed copies match
   what the generator produces. The committed lambda bundles are rebuilt and compared in CI, and the
   role skills are compiled from `.agents/roles` by `pnpm roles:generate` and checked by a devkit
   test. [ci: Build, Lint, & Test] [ci: Monitoring Lambda Bundle Build]
8. A hook lives in `.claude/hooks`, is wired in `.claude/settings.json`, and has a test in the
   devkit that runs the real script. The cloud guard fails closed when `node` is missing, and the
   hooks that only remind or catch accidents print a warning and skip when `jq` is missing.
   [review]

## Patterns

**Adding a devkit command.** Copy the nearest existing command, add its script alias at the root,
and write the test alongside it with a fixture client rather than a network call.

**Adding a hook.** Copy `analyst-guard.sh` for a guard and `docs-reminder.sh` for a reminder, and
add the test next to `tooling/devkit/src/hooks.test.ts`.

**Adding a shared lint rule.** Put it in `base.js` as a warning first if the repo has existing
violations, with the count in the commit message, then promote it to an error once the count reaches
zero. A rule that lands red gets disabled by whoever is blocked by it.

**A ratchet.** `apps/mobile/eslint.config.mjs` keeps its accepted exceptions in two lists that are
empty today, so a new violation is a hard error. Copy that shape when you tighten a rule.

**What CI runs.** Every third-party action is pinned to a full commit SHA with its version in a
comment. `Build, Lint, & Test` runs lint, type check and tests for the affected workspaces only, so
a change that touches none of them skips it. The browser suite in `apps/e2e` runs nightly and on
demand, not on pull requests, so it is not a merge gate.

**Coverage across the repo.** `@repo/vitest-config` owns the aggregation scripts, which collect each
workspace's JSON report and merge them. Run those rather than trying to configure a single root
vitest project.

## Known debt

`apps/macro-sandbox` has TypeScript tests and declares no `check-types`, so CI never type-checks
them. Needs a ticket.

Two root scripts go through turbo without a declared task: `ui-add` and `view-report`. No ticket.

`db:migrate` is `cache: false` but declares no `dependsOn`, so it does not wait for `^build`. It
works because the script runs through tsx. No ticket.

`packages/ui` excludes `src/**` from the type-aware configuration through a second config file, and
`apps/data` excludes its pipelines from ruff and pyright. Both are recorded in [ui.md](ui.md) and
[data.md](data.md), and both mean a shared rule does not reach the code that needs it most. Needs a
ticket.

No lint rule exists for type assertions or for barrel files, which are two of the strongest rules in
[code.md](code.md). Both are review-only today. Needs a ticket.

`.claude/hooks/protect-main.sh` has no test that runs it, against rule 8. Needs a ticket.

## Decisions

- 2026-09-21. `check-types` wins over `typecheck` because `turbo.json` and CI already use it, so
  renaming the eleven packages is the smaller change and the one that makes the existing commands
  true.
- 2026-09-21. The release plugin stays a local file rather than a published dependency. It encodes
  the rule that an app releases when a package it depends on changes, which is specific to this
  repository's layout.
- 2026-11-16. Reconciled with main, where every workspace that compiles TypeScript but one declares
  `check-types`, which closed the split recorded on 2026-09-21.
