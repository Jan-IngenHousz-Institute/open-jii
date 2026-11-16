# Cloud access from a session

An agent session may read what is running. It may not change it, read data or secrets, or read
production without the developer's say-so. That holds for every role and every agent, because an
engineer session has no more business applying infrastructure than an analyst one.

The analyst role, `.agents/skills/openjii-role-analyst/SKILL.md`, is the one built for this kind of
work and carries the full contract. This document is the shared part: the layers that enforce it,
what the developer does, and what is still only a rule.

## The layers

Four layers do different jobs, and none of them is enough alone.

1. The analyst permission set in AWS is the boundary. It grants describe, list and get, and denies
   data reads, secret values, credential mints and irreversible writes, whatever command reaches the
   API. `infrastructure/policies/README.md` describes it and how it is created.
2. The cloud guard, `.claude/hooks/analyst-guard.sh`, runs before every shell command in Claude Code
   and in Codex. It refuses a mistaken command with a reason before it reaches AWS, Databricks or
   OpenTofu. It is a guardrail: a command that reaches an API by another route meets only the
   permission set.
3. The permission rules in `.claude/settings.json` and `.codex/rules/openjii.rules` deny the
   production window command, `gh secret` and reads of secret files, and ask before a session
   dispatches a workflow, merges, releases or writes through `gh api`. A test in the devkit keeps
   the two tools' lists the same.
4. The role text carries what no tool can check, listed at the end of this document.

## What the guard refuses

The guard reads a command the way a shell does: quotes, escapes, line continuations, command
substitutions, heredocs and nested shells. A command inside `$(...)`, `bash -c`, `eval` or
`find -exec` is checked like any other, while quoted text and heredoc bodies are data, so a commit
message that mentions `tofu apply` is not a command.

It refuses:

- Anything that changes state in `aws`, `databricks` or `kubectl`. Only describe, list and get pass,
  minus the ones that read data, run code or mint credentials: object reads, secret values, table
  items, stream records, login passwords, session tokens, function invocations, command execution
  and instance sessions.
- OpenTofu beyond `fmt`, `validate`, `providers`, `graph` and `version`, `plan` and `init` included,
  because a plan needs state and credentials. `pnpm tf` and `pnpm tf:dev` are refused for the same
  reason, and `pnpm tf:fmt` is allowed.
- A parameter read with `--with-decryption`, `--debug`, `--endpoint-url`, and a payload passed with
  `--cli-input-json`.
- A log read with no time window, a `filter-log-events` without `--max-items` or a
  `get-log-events` without `--limit`, either above 1000, `--unmask`, and `aws logs tail --follow`.
  `filter-log-events` pages on its own, so only `--max-items` caps what it returns.
- A SQL statement that is not a single `SELECT`, `SHOW`, `DESCRIBE`, `EXPLAIN` or `WITH` query, that
  names a write anywhere, or that is not passed with `--statement`.
- `databricks api` beyond `get`, and a `get` of a secrets or token endpoint. `kubectl get secret` and
  `kubectl config view --raw`.
- Credentials written on the command line, and a shell read of a file that holds secrets: `.env`,
  `.env.local`, `*.tfvars`, `*.tfstate` and the AWS and Databricks credential files. The tracked
  `.env.example`, `.env.test` and `.env.default` files stay readable.
- A command whose name comes from a variable or a substitution, when the command mentions a cloud
  tool, because the guard cannot tell what it runs.
- Anything that reads production, unless the developer has opened the window. Production is
  recognised by a profile ending in prod, production or dr, whether on the command, exported earlier
  in it or set in the session's environment; by a resource name that carries the environment, such
  as `/aws/ecs/backend-service-prod`; and by a `cd` into `infrastructure/env/prod` or `env/dr`.
- Opening the production window, by command or by writing its marker.

Two reads of operational state are allowed because the runbooks need them: an object from the
heartbeat or status-state bucket written to stdout, as in
`aws s3 cp s3://open-jii-heartbeat-dev/heartbeat/2026/11/16/120000.json -`, and `$(date ...)` time
windows inside a command. Every command that touches a cloud tool and passes is appended to
`.claude/cloud-commands.log`, which git ignores.

The guard fails closed. Without `node` on the path, or when it cannot read the tool call, it refuses
the command rather than letting a cloud call through unchecked.

## Writing a command that passes

- Put options such as `--profile` and `--region` after the service and the verb, or right after
  `aws`. An option the guard does not know, placed before the service, is refused.
- Put the profile on the command, where it is visible.
- Give every log read a window, every `filter-log-events` a `--max-items` and every
  `get-log-events` a `--limit`.
- Pass SQL with `--statement`, as one query.
- A step the guard refuses, such as a function invoke, a secret, a session on an instance or a copy
  of raw data, is the developer's to run. Name it, say what it would show, and carry on with what you
  can read.

## What the developer does

Install `node` and `jq`. The cloud guard needs `node` and the other hooks need `jq`. A missing `jq`
makes those hooks print a warning and skip, while a missing `node` makes the cloud guard refuse
every command.

Once per machine, add a profile per account to `~/.aws/config`, pointing at the `openjii-analyst`
permission set. The portal URL and the region come from whoever administers Identity Center. Add
the two profiles to the `[sso-session openjii]` block you already have for `openjii-dev` and
`openjii-prod` rather than declaring a second one:

```ini
[profile openjii-analyst-dev]
sso_session = openjii
sso_account_id = <dev account id>
sso_role_name = openjii-analyst
region = eu-central-1
output = json

[profile openjii-analyst-prod]
sso_session = openjii
sso_account_id = <prod account id>
sso_role_name = openjii-analyst
region = eu-central-1
output = json
```

Authenticate yourself in your own terminal. The agent never runs a login and never reads a
credential file:

```bash
aws sso login --profile openjii-analyst-dev
databricks auth login --host <workspace url> --profile openjii-analyst-dev
```

Do not export `AWS_PROFILE` in the shell that starts the agent. If you do, the guard treats a
production profile as production for every command. Check the profile once with
`aws sts get-caller-identity --profile openjii-analyst-dev`: the role should contain
`AWSReservedSSO_openjii-analyst_`. If it shows something wider, the profile points at the wrong
permission set.

For production, open the window in your own terminal and say so in the conversation. The command
asks you to type `prod`, and it refuses to run without a terminal, which is how an agent's shell
runs it:

```bash
pnpm analyst:prod-window            # two hours
pnpm analyst:prod-window --status   # how long is left
pnpm analyst:prod-window --close    # end it early
```

The marker is `.claude/analyst-prod.ok` in the checkout you run it in, so open it in the checkout
the session works in, which for a worktree session is the worktree. The window lasts two hours for
every session in that checkout. It permits reads only, and the guard still refuses every change
while it is open.

## Other agents

Codex runs the same guard and the main-branch hook from `.codex/hooks.json`, and the forbidden and
prompt rules from `.codex/rules/openjii.rules`. Both load only once you trust the project in Codex,
and Codex asks you to review a hook again whenever it changes. Codex rules match command prefixes,
so the `gh api` write rules exist only on the Claude Code side.

Any other tool reads `AGENTS.md` and the role files but runs none of these hooks or rules. In such a
tool the permission set is the only layer that holds, so give it the analyst profile and never your
own.

## What is still only a rule

The guard cannot check intent, so the analyst role carries these and a reviewer should too:

- State a numbered plan of the exact commands before the first remote one, and wait for approval.
- Read one environment per session for AWS and Databricks. The daily round's Grafana and PostHog
  reads use scoped read tokens and are the exception.
- Summarise findings. No email address, name, IP address or token reaches a reply, a ticket, a
  document or a memory file.
- A refusal ends the attempt. Report it and propose another read, rather than finding another route.
- Write findings with the commands that produced them, so a person can rerun them.

Until the permission set exists and a developer's profile points at it, the guard and the rules are
the only layers, and a session inherits whatever that developer's own credentials allow. That is why
the numbered plan and the approval step are not optional.
