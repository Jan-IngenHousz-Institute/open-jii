# Tooling

`tooling/*`, `turbo.json` and the root scripts. The shared configuration every workspace inherits,
plus the devkit that holds the local commands needing a credential.

## Shape

```text
tooling/eslint/            flat configs: base, nextjs, react, nest, theme-tokens
tooling/typescript-config/ base, nestjs, nextjs, react-library
tooling/tailwind/          base, web, native
tooling/vitest-config/     base, ui, setup, mobile, plus coverage aggregation
tooling/devkit/            the local commands: login, linear:*, release-cms, env generation
tooling/release/           the dependency-aware semantic-release plugin
```

## Rules

1. Every workspace declares `check-types`. That is the name `turbo.json` knows and the name CI runs,
   so a workspace declaring `typecheck` instead is not actually checked by either. [review]
2. A lint rule that should apply everywhere goes in `tooling/eslint/base.js`. A per-app config adds
   a rule or tightens a ratchet; it does not switch a shared rule off. An exception is an explicit
   list of legacy files, kept in the config where a reader can see it shrinking. [review]
3. A root script that goes through turbo needs a task declared in `turbo.json`, or it runs with no
   dependency graph and no caching. [review]
4. A devkit command is one file exporting `async function run(args: string[]): Promise<number>`,
   taking its dependencies as parameters so a test can substitute them, and guarded at the bottom
   so importing the module never executes it:

   ```ts
   if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
     process.exitCode = await run(process.argv.slice(2));
   }
   ```

   [review]

5. A credential is read inside the process that needs it and never passed through a shell. The
   Linear key lives in an owner-only file that the devkit reads directly, which is why there is no
   command that echoes it. [review]
6. A destructive remote operation needs an explicit flag. The devkit refuses any Linear mutation
   whose name contains Delete or Archive unless told otherwise, and logs every mutation it does
   perform. [review]
7. Generated files are generated, not edited. `apps/backend/.env.example` comes from the env
   manifest, and a test asserts the committed copy matches what the generator produces. [review]

## Patterns

**Adding a devkit command.** Copy the nearest existing command, add its script alias at the root,
and write the test alongside it with a fixture client rather than a network call.

**Adding a shared lint rule.** Put it in `base.js` as a warning first if the repo has existing
violations, with the count in the commit message, then promote it to an error once the count reaches
zero. A rule that lands red gets disabled by whoever is blocked by it.

**Coverage across the repo.** `@repo/vitest-config` owns the aggregation scripts, which collect each
workspace's JSON report and merge them. Run those rather than trying to configure a single root
vitest project.

## Known debt

The type-check script name is split across the repo. Eleven workspaces declare `typecheck`, five
declare `check-types`, `apps/mobile` declares both identically, and eight declare neither, including
`apps/backend`, `packages/database` and both sandboxes. `turbo.json` only knows `check-types`, so
the root `pnpm typecheck` command and the CI type-check step cover disjoint halves of the workspace
and neither covers everything. Renaming them all to `check-types` and deleting the root `typecheck`
script is the fix, and new packages are already picking the right name unprompted:
`packages/monitoring` arrived with `check-types`. Needs a ticket.

Four root scripts go through turbo without a declared task: `typecheck`, `ui-add`, `view-report` and
the test project variants. No ticket.

`db:migrate` is `cache: false` but declares no `dependsOn`, so it does not wait for `^build`. It
works because the script runs through tsx. No ticket.

`packages/ui` excludes `src/**` from the type-aware configuration through a second config file, and
`apps/data` excludes its pipelines from ruff and pyright. Both are recorded in [ui.md](ui.md) and
[data.md](data.md), and both mean a shared rule does not reach the code that needs it most. Needs a
ticket.

No lint rule exists for type assertions or for barrel files, which are two of the strongest rules in
[code.md](code.md). Both are review-only today. Needs a ticket.

## Decisions

- 2026-09-21. `check-types` wins over `typecheck` because `turbo.json` and CI already use it, so
  renaming the eleven packages is the smaller change and the one that makes the existing commands
  true.
- 2026-09-21. The release plugin stays a local file rather than a published dependency. It encodes
  the rule that an app releases when a package it depends on changes, which is specific to this
  repository's layout.
