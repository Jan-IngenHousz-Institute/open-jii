# Infrastructure

`infrastructure/`, which is OpenTofu. Three environment root modules, a separate root for data
governance, and 44 directories of reusable modules. Six of those hold several smaller modules, and
73 module directories exist once those are counted.

Change it only when that is explicitly the task. An infrastructure change that rides along with a
feature is how an environment ends up in a state nobody intended.

## Read first

- `infrastructure/README.md`.
- The environment root you are changing, whose `main.tf` shows how the modules are composed.
- The README inside the module you change, because most modules explain their own ordering and
  bootstrap.
- `docs/agents/cloud-access.md`, for what a session may read from the cloud and how a developer
  signs in.
- `docs/runbooks/`, for what each alert means.

## Shape

```text
env/dev, env/prod, env/dr    one root module each, with backend.tf, main.tf, variables.tf and
                             versions.tf, plus a file for anything that belongs to one root only
                             (posthog.tf in dev, equipment-dns.tf in prod)
data-governance/             a separate root with its own state, applied by hand
modules/                     44 directories of reusable modules, 73 module directories in all
```

Environments are separated by root module and remote state, not by workspaces. Each `backend.tf`
pins its own S3 bucket with a DynamoDB lock table, and each `main.tf` builds resource names from
`var.environment` and passes the primary and disaster-recovery provider pair explicitly.

No workflow plans or applies `env/dr`, so it is applied by hand, like `data-governance`.

## Rules

1. Resource names derive from `var.environment` rather than being written per environment, so a
   module instantiated in two roots cannot collide. [review]
2. A module takes its providers explicitly when it creates anything in the recovery region, in a
   Databricks workspace or account, or in the Grafana workspace. Do not rely on the default provider
   for those. [review]
3. Nothing is applied from a feature branch. A merge to main applies dev when the change touches
   `infrastructure/` or the SQL views the roots read. Production is applied by a manual deploy that
   has to start from main or a release branch and waits for an approval. Each apply uses the plan
   that was saved before its approval step, so what runs is what was planned. [review]
4. Agents do not run OpenTofu beyond `fmt`, `validate`, `providers`, `graph`, `version` and `help`,
   and not even `plan` or `init`. A plan needs state access and credentials, and developer machines
   are not expected to hold the variable files a plan requires. The guard hook also blocks every
   `pnpm tf` script. `docs/agents/cloud-access.md` says what a session may do against the cloud.
   [hook: analyst-guard]
5. Run `tofu fmt` recursively before committing. CI checks formatting only in the root of the
   environment it plans, so a badly formatted module can still pass. [review]
6. Expect the infrastructure scan to run on your change. A finding the team accepts gets an inline
   ignore annotation next to the resource, with the reason in the comment above it.
   [ci: OpenTofu (Security Scan)]
7. Variable files stay off developer machines. A root that needs values gets them from a data source
   or from CI, and a file of real values in a checkout is a finding rather than a convenience.
   [review]
8. A secret is never a plain variable in a committed file. State holds sensitive values in clear
   text, which is why the state buckets are locked down and why nothing reads them casually.
   [review]
9. A Lambda bundle committed as `function.zip` in a module is rebuilt from source and committed with
   the change that alters it. Run `pnpm turbo run build --filter=@repo/monitoring`, then
   `npm run build` in each affected `lambda` directory. [ci: Monitoring Lambda Bundle Build]
10. An alert rule in `modules/grafana/dashboard`, its entry in
    `docs/monitoring/metrics-catalog.yaml` and the runbook that entry names in `docs/runbooks`
    change together. The consistency test in `packages/monitoring` fails when they diverge. [review]
11. The PostHog project is shared by every environment and is applied from the dev root only, so a
    change to `modules/posthog` is live everywhere when it merges. Change a flag's rollout only when
    every running release behaves correctly under both values. [review]
12. A change to `apps/data/src/views/` is an infrastructure change. The roots read those files, and
    a merge applies them to dev. [review]

## Patterns

**Adding a resource.** Find the module that owns that class of thing, extend it, and instantiate it
in the environment root. A resource added straight into a root module rather than a module is the
thing to avoid, because the next environment cannot reuse it.

**Promoting to production.** A merge to main applies dev. Production is a separate manual run, and a
batch of merges arrives as one plan and one apply, so a change that needs a specific ordering has to
say so. Every pull request that touches infrastructure shows a plan for dev and a read-only plan for
prod. The prod plan compares the change with the recorded state without refreshing it, so drift
shows in the release's own plan.

**A change that needs two applies.** A new environment's sandbox functions are the known case,
because one apply creates the image repository and the function, and the function needs an image
that only a workflow pushes. The Grafana workspace is another, applied first with `-target`. The
module's README says how to order each one. Plan for it rather than discovering it halfway through a
promotion.

**Adopting something made by hand.** Declare it in the module, add an `import` block to the root,
apply, and delete the `import` block in a later change once the apply has run.

## Known debt

Identity Center is administered by hand and nothing about it is under version control here. Who can
assume what in each account, who is in which group, and every permission set a person assumes cannot
be reviewed as a diff. Needs a ticket.

`modules/databricks/job/main.tf` creates one permissions resource per entry with `count`, and each
one is authoritative for the whole access control list, so they overwrite each other. All seven jobs
pass one principal today, so nothing is wrong yet, but adding a second principal to any job exposes
it. The pipeline module already fixed the same shape and says so in a comment. Needs a ticket.

`.github/actions/tofu/tofu-fmt-check/action.yml` runs `tofu fmt -check` without `-recursive` and
defaults to continuing on error, so a formatting failure does not stop a pull request and nothing
checks `modules/`, `env/dr` or `data-governance/`, against rule 5. Needs a ticket.

`modules/vpc/main.tf`, `modules/iot-core/main.tf` and two grafana modules carry 64 divider comment
lines, and 23 `.tf` files carry em dashes in comments, against rules 2 and 11 of
[prose.md](prose.md). Fix them in the files you are editing anyway. No ticket.

## Decisions

- 2026-09-21. Environments stay separate root modules rather than workspaces. State is fully
  separated, a mistake in one root cannot reach another, and the duplication in `main.tf` is the
  price.
- 2026-09-21. `data-governance` stays a hand-applied root outside CI, because it configures the
  account-level metastore and its blast radius is every environment at once.
- 2026-11-16. This document was reconciled with main on 16 November 2026.
