# Agent roles

A role is what an agent session works as. It is an onboarding document rather than a task guide: it
says what the session is for, what it refuses, which skills and standards to reach for, which model
tier suits it, and when it is finished. A skill tells you how to do one job; a role tells you what
kind of work you are doing at all.

This exists so that a developer can name a role and a task and get consistent behaviour, instead of
every developer onboarding an agent their own way and paying for it in tokens and in quality.

## It is optional

Nobody has to use this. A session that takes no role works exactly as it did before, and the
standards under `docs/standards/` apply either way, because those are about the code rather than
about how you drive an agent.

What the hooks do is offer. A fresh session sees the list once, and a first prompt may get one
suggestion. Both say they are suggestions, neither repeats itself, and ignoring them costs nothing.

If you would rather not see any of it, turn it off on your machine and it stays off:

```bash
touch .claude/roles-off          # this checkout, untracked
export OPENJII_ROLES=off         # this shell
```

That silences the role list, the suggestion and the drift note. It does not touch
`analyst-guard.sh`, which keeps cloud state read-only; that one is a safety mechanism rather than a
convenience, and it has no opt-out.

Once you do take a role, its text is written as instructions rather than suggestions. The choice is
opting in; after that, the point of a role is that it is specific.

## Where the files are

```text
.agents/roles/baseline.md          the part every role carries
.agents/roles/<role>.md            one role's own half, with its frontmatter
.agents/skills/openjii-role-<role>/SKILL.md    generated from those two
.claude/skills/openjii-role-<role>             symlink, as for every other skill
```

The generated file is what an agent actually reads, and it is self-contained. Run
`pnpm roles:generate` after editing a source file, and `pnpm roles:check` to verify that the
committed output matches its source, that the symlink exists, and that the prose holds up. Both run
in the devkit, and `pnpm --filter @repo/devkit test` covers them.

## Why it is compiled rather than assembled at read time

The baseline carries the safety rules, the git rules and the communication standard. Those are the
parts that must not be skipped, so they are in the file the agent reads rather than behind an
instruction to go and read another file. Three alternatives were rejected:

- Inlining the baseline with a shell command in the skill body runs on every invocation, needs a
  permission rule, is replaced with a policy notice in some environments, and shows other tools a
  literal backtick command.
- "Read the baseline first" makes the least skippable content the most skippable.
- A subagent definition under `.claude/agents/` cannot compose from a shared baseline either, locks
  a whole session to one role, and is invisible to every tool that is not Claude Code.

The cost of compiling is that the baseline text is physically repeated in each generated file. The
check is what makes that safe: a stale copy fails the test rather than quietly drifting.

## How a session gets a role

Two hooks, both bash and jq, both silent unless they have something to say. A third hook,
`analyst-guard.sh`, is unrelated to roles: it keeps every session from changing cloud state, and
`docs/agents/cloud-access.md` covers it.

`session-start.sh` runs on startup and on clear, and prints the role list with the instruction to
pick one. On resume and after a compaction it instead names the role the session already had, since
a re-attached skill can fall out of context when the budget is tight.

`role-router.sh` runs on every prompt. On the first one it classifies the text and suggests a role.
The order is the classifier and the first match wins: a pasted stack trace goes to triage; a ticket
reference with design words to project management, and a bare ticket reference to the engineer; a
review request to the reviewer; release words to the release manager; a design request with no
ticket to project management; documentation or screenshots to the docs writer; anything about a
running environment to the analyst; a build verb such as add, implement or rename to the engineer; a
visual complaint to the designer; a short question to the butler; and anything else to the
generalist.

The build verb deliberately outranks the visual words, so "implement the threshold colour mode" is
engineering rather than design. The classification is otherwise crude on purpose, because the model
makes the fine decision and the hook only saves the first exchange. It writes what it read to
`candidate` and what it suggested to `role`, which differ while a role is still being written: a
suggestion always falls back to a role whose skill actually exists.

The router never exits non-zero. A non-zero exit on this event discards the developer's prompt,
which would be a much worse failure than a missed suggestion.

## Drift

After the first turn the router has one remaining job. At 30 and at 60 developer turns, and on the
second compaction, it injects a one-time note asking whether the session is still doing what it was
started for, and to recommend a fresh roled session with a handoff block if it is not. It is a
recommendation; the developer decides.

Counting turns is less obvious than it looks. Tool results arrive in the transcript as `user` lines
and so does a compaction summary, so counting `type == "user"` overstates the number by an order of
magnitude. The counter filters both, which is why a session with four prompts and four hundred tool
results does not get nudged.

## State

Per session, under `${TMPDIR}/openjii-roles/<session id>/`, the same shape the docs reminder uses:
`routed` once the first prompt has been handled, `role` and `candidate` as described above, and a
marker per drift threshold so each fires once. Nothing persists between sessions, which is the
point.

## Using a role without Claude Code

Read `.agents/skills/openjii-role-<name>/SKILL.md` and follow it. The file is self-contained, so
nothing is lost except the hooks: no suggestion on the first turn and no drift nudge, which is why
the baseline also states the drift rule in prose.

## Adding a role

Write `.agents/roles/<name>.md` with frontmatter carrying `name: openjii-role-<name>` and a
description saying when to use it, then a level-one heading and the body. Say what the role is for,
how to work in it, what it refuses and hands off instead, which skills it reaches for, its model
tier and fan-out policy, and how it knows it is done. Then run `pnpm roles:generate`, add the
symlink, and add the role to the list in `session-start.sh` and to the classifier in
`role-router.sh` if a prompt should route to it.
