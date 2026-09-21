# Cloud access from a session

A session may read what is running. It may not change it. That holds for every role, because an
engineer session has no more business applying infrastructure than an analyst one, and it is
enforced by a hook rather than left to good intentions.

The analyst role, `.agents/skills/openjii-role-analyst/SKILL.md`, is the one built for this kind of
work and carries the full contract. This document is the shared part: what the hook does, what the
developer does, and what is still only a rule.

## What the hook blocks

`.claude/hooks/analyst-guard.sh` runs before every Bash command and refuses:

- Anything mutating in `aws`, `databricks` or `kubectl`. Only describe, list and get-class verbs
  pass, minus the ones that read data or mint credentials: object reads, secret values, table items,
  stream records, login passwords, session tokens, shadow reads, invocations and command execution.
- OpenTofu beyond `fmt`, `validate`, `providers`, `graph` and `version`. `plan` and `init` are
  blocked with `apply`, because a plan needs state and credentials, and developer machines are not
  expected to hold the variable files a plan requires. `pnpm tf` is blocked for the same reason.
- A parameter read with `--with-decryption`, which returns the secret rather than its name.
- `--debug`, which prints signing material, and `--endpoint-url`, which sends the call elsewhere.
- A log read with no time window, with no limit, or with a limit above 1000.
- A statement that does not start with `SELECT`, `SHOW`, `DESCRIBE`, `EXPLAIN` or `WITH`, or that
  contains a semicolon and could therefore carry a second statement.
- Credentials written on the command line as an inline environment assignment.
- A cloud command wrapped in `bash -c`, `eval`, `xargs`, a command substitution or backticks, where
  the guard cannot see what actually runs.
- Anything touching production, unless the developer has opened a window. Production is recognised
  three ways, on the whole command line rather than per segment: a profile whose name contains prod,
  production or dr; a path under `infrastructure/env/prod` or `env/dr`; and a resource name carrying
  the environment as a suffix, so `--log-group-name /aws/ecs/backend-service-prod` counts whatever
  profile is active. The separators are anchored, so a bucket called `open-jii-products` does not.
- Creating the window marker itself, because that decision is the developer's.

Every command that passes is appended to `.claude/cloud-commands.log`, which is ignored by git.

The guard splits a command on separators and checks each part, so a mutation hidden behind a read is
refused. Within a part it scans for the CLI rather than assuming it comes first, because `env aws`,
`time aws`, `/usr/local/bin/aws`, an escaped `\aws` and a loop body all put something else in
position one, and each of those walked straight past an earlier version of this hook.

Two deliberate imprecisions. A separator inside a quoted string splits the command anyway, which can
refuse something harmless. And quoted text is excluded when deciding whether a part invokes a CLI at
all, so `git commit -m "fix the aws ecs update-service call"` is not refused; the cost is that a
command whose name is itself quoted, like `"aws" s3 rm`, is not seen. Both are recorded here rather
than discovered later.

A command that mentions none of these tools exits the hook immediately, so the cost on an ordinary
`ls` or `git status` is a few milliseconds rather than the full check.

## What the developer does

Once, per machine. Add a profile per account to `~/.aws/config`, pointing at the `openjii-analyst`
permission set. The portal URL and the region come from whoever administers Identity Center:

```ini
[sso-session openjii]
sso_start_url = https://<portal>.awsapps.com/start
sso_region = eu-central-1
sso_registration_scopes = sso:account:access

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

Then per session, authenticate yourself. The agent never runs a login and never reads a credential
file:

```bash
aws sso login --profile openjii-analyst-dev
databricks auth login --host <workspace url> --profile openjii-analyst-dev
```

Do not export `AWS_PROFILE` in the shell that starts the agent. The profile belongs on each command,
where it is visible. Worth doing once yourself: `aws sts get-caller-identity --profile
openjii-analyst-dev` should show a role containing `AWSReservedSSO_openjii-analyst_`. If it shows
something wider, the profile is pointing at the wrong permission set and the guard is the only thing
standing between the agent and a mutation.

For production, open the window in your own terminal and say so in the conversation:

```bash
pnpm analyst:prod-window            # two hours
pnpm analyst:prod-window --status   # how long is left
pnpm analyst:prod-window --close    # end it early
```

The window permits reads. It does not permit changes, and the guard still refuses every mutation
while it is open.

## What is still only a rule

The hook cannot check intent, so the analyst role carries these and a reviewer should too:

- State a numbered plan of the exact commands before the first remote one, and wait for approval.
- One environment per session.
- Summarise findings. No email address, name, IP address or token reaches a reply, a ticket, a
  document or a memory file.
- A refusal ends the attempt. Report it and propose another read, rather than finding another route.
- Write findings with the commands that produced them, so a person can rerun them.

## Permissions

The `openjii-analyst` permission set grants describe, list and get
across the services this estate runs, log reads on the named application log groups, parameter reads
on the four plain-string prefixes, and explicit denies on every data read, every credential mint and
every irreversible write. Its README explains the shape and the two things it deliberately withholds.

Two layers, then, doing different jobs. The permission set is what AWS enforces, and it holds even
if a command reaches the API by a route the hook never saw. The hook is what catches a mistake
before it becomes an API call, and it covers Databricks, where there is no per-session narrowing at
all.

Until the permission set is applied and a developer's profile points at it, the hook is the only
layer, and a session inherits whatever that developer's own credentials allow. That is the reason
the numbered plan and the approval step are not optional.
