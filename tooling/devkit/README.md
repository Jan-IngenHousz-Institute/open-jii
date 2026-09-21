# @repo/devkit

Local development commands that need a credential, written so the credential never reaches a
command line, a shell history, or an agent's context. Each command resolves what it needs in its
own process and hands back a file or a result, not a secret.

Run them from the repo root through the aliases in the root `package.json`.

| Command                                   | What it does                                            |
| ----------------------------------------- | ------------------------------------------------------- |
| `pnpm local:login`                        | Signs in the seed user and writes a session header file |
| `pnpm linear:auth`                        | Stores your Linear key in `tooling/devkit/.env`         |
| `pnpm linear:query`                       | Runs one GraphQL document against Linear                |
| `pnpm linear:check`                       | Checks a ticket draft against the ticket standard       |
| `pnpm linear:create`                      | Creates the tickets in a draft, with comments and links |
| `pnpm linear:taxonomy`                    | Plans and applies the `OJD` label taxonomy              |
| `pnpm linear:apply`                       | Applies a reviewed per-ticket change file in batches    |
| `pnpm --filter @repo/devkit env:generate` | Regenerates the `.env.example` files from the manifest  |

## Linear access

Optional, and only for maintainers with a Linear seat. It lets you and your agent work `OJD`
tickets: look one up, refine it, write the testing criteria before review, sweep the backlog. The
repo works without it, and the `linear:*` commands say so rather than guessing.

Mint a personal key at [Security and access](https://linear.app/settings/account/security). Give
it the **Read** and **Write** scopes and restrict it to team **OJD**; do not create a full-access
key. Linear also offers narrower scopes such as `issues:create`. A key minted that way creates
tickets fine and then fails its first comment with `Invalid scope: write or comments:create
required`, so if you go narrower than Write, include `comments:create` as well.

Copy the key, then pipe it in so it is never typed or echoed:

```bash
pbpaste | pnpm linear:auth
```

It lands in `tooling/devkit/.env`, owner-only and gitignored, the same way each app owns its own
`.env`. The command checks the key against Linear before storing anything and prints whose it is,
never the key. To rotate, regenerate it in Linear and run this again.

The commands look for the key in the shell, then in this checkout's `tooling/devkit/.env`, then in
the main worktree's, so running `linear:auth` once in the main checkout serves every worktree. A
refusal names each path it tried. Confirm it works:

```bash
pnpm linear:query --query '{ viewer { name } }'
```

The key is yours, not the team's. Everything it writes is attributed to you, so never share it,
never paste it into a ticket, a PR or a chat, and never put it in a command line.

`pnpm linear:query` takes `--query '<document>'` or `--file <path.graphql>`, plus
`--variables '<json>'`. Pass `--output <file>` to write the JSON to a file instead of stdout; pnpm
prints its own lines around stdout, so anything that parses the result should read the file. The
command refuses any `*Delete` or `*Archive` mutation unless you pass `--allow-destructive`,
refuses to select a webhook's `secret`, and appends every mutation to `.claude/linear-writes.log`.
Each log line names the agent session (`CLAUDE_CODE_SESSION_ID`, or `shell`) and the checkout that
wrote it, and marks destructive mutations, so a key shared by several sessions still answers who
did what. Linear itself only ever sees the key's owner.

What to write into a ticket, which labels exist, and the skills that do the writing are in
`AGENTS.md` and `docs/agents/`.

## Writing tickets from a draft

A draft is one Markdown file holding one or more tickets. `pnpm linear:check` runs the mechanical
half of the ticket standard on it, and `pnpm linear:create` creates what it holds. `.claude/tickets/`
is gitignored and a good place to keep drafts.

```markdown
---
project: Platform home and research discovery
team: OJD
state: Backlog
---

# Researcher can sort any resource list by up to two columns

labels: Feature, Fullstack
blocks: 2

## User story

**WHO:** A researcher browsing any of the five resource lists.

...

## Testing criteria

<!-- comment -->

Suggested implementation. Add a shared `sort` input in `shared/listing.ts`; {{2}} adds the facets.

# Researcher can filter any resource list and share the filtered view

labels: Feature, Fullstack

## User story

...
```

The front matter names the project (required to create), the team (default `OJD`) and the state
(default `Backlog`). Each level-one heading starts a ticket; `labels:` and `blocks:` may sit
between it and the first level-two heading. Everything after `<!-- comment -->` is posted as a comment once the
ticket exists, which is where implementation pointers go when the body has no room. `{{2}}`
anywhere in a body or comment becomes the second ticket's identifier.

```bash
pnpm linear:check .claude/tickets/home.md            # shape, budget, bullets, dashes, title, gate
pnpm linear:create .claude/tickets/home.md           # dry run: resolves names, prints the plan
pnpm linear:create .claude/tickets/home.md --apply   # creates, then references, comments, relations
```

`linear:create` refuses a draft that fails the check, resolves team, project, state and labels by
name, and records every step in `<draft>.created.json` next to the draft. A run that stops halfway
resumes from that file instead of creating anything twice. A relative path, here and on every other command, is taken from the repo root.

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

Repo-wide rules in `.claude/` keep secrets out of an agent's context and releases in human hands, so
an agent can be refused where you would not be. The refusal says what to do instead, and the answer
is usually that the tool needing the secret should read it itself.

Those rules cannot be relaxed in your own settings, so a refusal that blocks something legitimate is
worth reporting rather than working around. Run the command in your own terminal meanwhile.

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
