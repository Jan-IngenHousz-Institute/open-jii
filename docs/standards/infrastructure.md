# Infrastructure

`infrastructure/`, which is OpenTofu. Three environment root modules, 40 reusable modules, and a
separate root for data governance.

Change it only when that is explicitly the task. An infrastructure change that rides along with a
feature is how an environment ends up in a state nobody intended.

## Read first

- `infrastructure/README.md`.
- The environment root you are changing, whose `main.tf` shows how the modules are composed.

## Shape

```text
env/dev, env/prod, env/dr    one root module each: backend.tf, main.tf, variables.tf, versions.tf
data-governance/             a separate root with its own state, applied by hand
modules/                     40 reusable modules
```

Environments are separated by root module and remote state, not by workspaces. Each `backend.tf`
pins its own S3 bucket with a DynamoDB lock table, and each `main.tf` builds resource names from
`var.environment` and passes the primary and disaster-recovery provider pair explicitly.

## Rules

1. Resource names derive from `var.environment` rather than being written per environment, so a
   module instantiated in two roots cannot collide. [review]
2. A module takes its providers explicitly when it creates anything in the recovery region. Do not
   rely on the default provider for a cross-region resource. [review]
3. Nothing is applied from a feature branch. CI applies dev when a change merges, and production
   only on a manual promotion. [review]
4. Agents do not run OpenTofu at all, not even `plan`. A plan needs state access and credentials,
   and developer machines are not expected to hold the variable files a plan requires. The guard
   hook blocks everything except `fmt`, `validate`, `providers`, `graph` and `version`.
   [hook: analyst-guard]
5. Run `tofu fmt` recursively before committing, and expect the security scan to run on your
   change. [ci: OpenTofu (Security Scan)]
6. Variable files stay off developer machines. A root that needs values gets them from a data source
   or from CI, and a file of real values in a checkout is a finding rather than a convenience.
   [review]
7. A secret is never a plain variable in a committed file. State holds sensitive values in clear
   text, which is why the state buckets are locked down and why nothing reads them casually.
   [review]

## Patterns

**Adding a resource.** Find the module that owns that class of thing, extend it, and instantiate it
in the environment root. A resource added straight into a root module rather than a module is the
thing to avoid, because the next environment cannot reuse it.

**Promoting to production.** Merge to main applies dev. Production is a separate manual step, and a
batch of merges arrives as one apply, so a change that needs a specific ordering has to say so.

**A change that needs two applies.** Detaching and deleting a CloudFront distribution is the known
case. Plan for it rather than discovering it halfway through a promotion.

## Known debt

The root `tf` script runs `tofu init && tofu plan && tofu apply` against dev from a developer's
machine, which contradicts rule 3. It predates the CI apply path. Either remove it or rename it so
nobody runs it by reflex. Needs a ticket.

`infrastructure/README.md` documents AWS authentication as `aws configure` with a static access key,
which is not how anyone should be authenticating. It needs replacing with the SSO procedure. Needs a
ticket.

Identity Center is administered by hand and nothing about it is under version control here, so who
can assume what in each account is not reviewable as a diff. Who is in which group, and every other permission set a person assumes, is still configured
outside version control. Needs a ticket.

`modules/databricks/job/main.tf` creates one permissions resource per entry with `count`, and each
one is authoritative for the whole access control list, so they overwrite each other. The pipeline
module already fixed the same shape and says so in a comment. Adding a third principal to a job
exposes it. Needs a ticket.

## Decisions

- 2026-09-21. Environments stay separate root modules rather than workspaces. State is fully
  separated, a mistake in one root cannot reach another, and the duplication in `main.tf` is the
  price.
- 2026-09-21. `data-governance` stays a hand-applied root outside CI, because it configures the
  account-level metastore and its blast radius is every environment at once.
