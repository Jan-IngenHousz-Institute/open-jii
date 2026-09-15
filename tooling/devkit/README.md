# @repo/devkit

Local development commands that need a credential, written so the credential never reaches a
command line, a shell history, or an agent's context. Each command resolves what it needs in its
own process and hands back a file or a result, not a secret.

Run them from the repo root through the aliases in the root `package.json`.

| Command                                   | What it does                                            |
| ----------------------------------------- | ------------------------------------------------------- |
| `pnpm local:login`                        | Signs in the seed user and writes a session header file |
| `pnpm linear:auth`                        | Stores your Linear key in the OS keychain               |
| `pnpm linear:query`                       | Runs one GraphQL document against Linear                |
| `pnpm linear:taxonomy`                    | Plans and applies the `OJD` label taxonomy              |
| `pnpm linear:apply`                       | Applies a reviewed per-ticket change file in batches    |
| `pnpm --filter @repo/devkit env:generate` | Regenerates the `.env.example` files from the manifest  |

## Linear access

Optional, and only for maintainers with a Linear seat. It lets you and your agent work `OJD`
tickets: look one up, refine it, write the testing criteria before review, sweep the backlog. The
repo works without it, and the `linear:*` commands say so rather than guessing.

Mint a personal key at [Security and access](https://linear.app/settings/account/security). Scope
it to **Read plus Write** and restrict it to team **OJD**. Do not create a full-access key.

Copy the key, then pipe it in so it is never typed or echoed:

```bash
pbpaste | pnpm linear:auth          # macOS Keychain, or secret-tool on Linux
pbpaste | pnpm linear:auth --file   # fallback: .claude/.env, owner-only, gitignored
```

The command checks the key against Linear before storing anything and prints whose it is, never the
key. To rotate, regenerate it in Linear and run this again. Confirm it works:

```bash
pnpm linear:query --query '{ viewer { name } }'
```

The key is yours, not the team's. Everything it writes is attributed to you, so never share it,
never paste it into a ticket, a PR or a chat, and never put it in a command line.

`pnpm linear:query` takes `--query '<document>'` or `--file <path.graphql>`, plus
`--variables '<json>'`. It refuses any `*Delete` or `*Archive` mutation unless you pass
`--allow-destructive`, refuses to select a webhook's `secret`, and appends every mutation to
`.claude/linear-writes.log`.

What to write into a ticket, which labels exist, and the skills that do the writing are in
`AGENTS.md` and `docs/agents/`.

## A local session without a browser

```bash
pnpm local:login
```

Signs in the seeded user by reading the one-time code straight from your local Postgres, then
writes the session to `.claude/session.header` with owner-only permissions. Use it without reading
it:

```bash
curl -H @.claude/session.header http://127.0.0.1:3020/api/v1/experiments
```

Pass `--email` for a different seeded account, or `--print` to put the cookie on stdout instead.
Reading sign-in codes only works against a local database; the command refuses any host that is not
loopback, which is the same guard the end-to-end fixtures use.

## Label taxonomy, for maintainers

`pnpm linear:taxonomy` prints the difference between the live `OJD` labels and the spec in
`src/linear/taxonomy.ts`, which mirrors `docs/agents/linear-taxonomy.md`. It writes nothing until
you name a phase:

```bash
pnpm linear:taxonomy                                  # dry run
pnpm linear:taxonomy --apply --step groups,creates    # additive, breaks nothing
```

Phases run in the order `groups`, `creates`, `renames`, `merges`, `retires`, cheapest and most
reversible first. Retiring a label hides it while leaving it on the issues that carry it, and can
be undone; nothing here deletes a label. The compliance series and the `wayfinder:` labels are
refused outright.

For per-ticket work, put the judgement in a change file and let `pnpm linear:apply <file>` do the
writing. It groups identical updates, batches them, and prints what it would do until you pass
`--apply`.

This touches a workspace nine people share and Linear has no undo for a bulk change. Dry run,
show someone the counts, then apply one phase at a time.

## Why a command may refuse you

`.claude/settings.json` and `.claude/hooks/protect-secrets.sh` keep secrets out of an agent's
context and releases in human hands. Expect a refusal if an agent is asked to read a `.env`, print
a token, dump the environment, search the keychain, or publish a build. The message says what to do
instead, and the answer is usually that the tool which needs the secret should read it itself.

Those rules are repo-wide and cannot be relaxed in your own settings, so a refusal that blocks
something legitimate is a bug worth reporting rather than working around. Run the command in your
own terminal meanwhile.

## Working on the devkit

Commands live in `src/commands/`, shared pieces in `src/lib/`. Each command exports its logic as
pure functions taking their dependencies as arguments, with a thin `run(args)` at the bottom behind
an `import.meta.url` guard, so the tests never spawn a process or reach the network.

```bash
pnpm --filter @repo/devkit test
pnpm --filter @repo/devkit typecheck
```

`src/hooks.test.ts` is the exception: it spawns the repo's Git and secrets hooks with real payloads
and asserts on their exit codes, so a change to either is caught in CI.
