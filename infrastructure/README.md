# openJII infrastructure

OpenJII's cloud resources are declared with OpenTofu. Environment compositions live under `infrastructure/env/`, CI's own access lives under `infrastructure/foundation/`, and reusable modules live under `infrastructure/modules/`.

| Composition       | Region in `variables.tf` | Purpose                                                                                                                                                                                                                                        |
| ----------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `env/dev`         | `eu-central-1`           | Development services and data paths.                                                                                                                                                                                                           |
| `env/prod`        | `eu-central-1`           | Production services and data paths, including cross-region backup configuration.                                                                                                                                                               |
| `env/dr`          | `eu-west-1`              | Disaster recovery configuration. It references some production resources and creates traffic-switching DNS records only when its cutover input is enabled. This directory establishes configuration, not evidence that a DR stack is deployed. |
| `foundation/dev`  | `eu-central-1`           | Dev's CI roles, GitHub trust, state bucket and lock table.                                                                                                                                                                                     |
| `foundation/prod` | `eu-central-1`           | The same for prod.                                                                                                                                                                                                                             |

Each composition has its own `main.tf`, variables and S3 state backend. There is no `env/staging` directory. Read the target environment's files before changing a module or interpreting a plan.

## Repository map

```text
infrastructure/
├── env/
│   ├── dev/
│   ├── prod/
│   └── dr/
├── foundation/
│   ├── dev/
│   └── prod/
├── modules/
│   ├── iot-core/
│   ├── kinesis/
│   ├── databricks/
│   ├── grafana/
│   ├── opennext/
│   └── ...
└── README.md
```

The environment compositions select the modules they need. The DR composition does not provision a Databricks workspace or Grafana, but it stores connection details for the existing production Databricks workspace in a Secrets Manager module. Dev and prod provision their own Databricks and Grafana resources. Follow the source references in each environment's `main.tf` for the exact current set.

## Foundation

`foundation/` holds what lets CI reach AWS: the GitHub OIDC trust, the deploy role, prod's read-only plan role, the state bucket and the lock table. The environment roots only read these, so a change to CI's access goes through its own workflow.

A release runs the Foundation workflow before the infrastructure deploy whenever `foundation/` or the `iam-oidc`, `s3` or `dynamodb` modules change, and on every dispatched run with `deploy_infrastructure` on, which includes a prod release that deploys infrastructure. It plans with the environment's deploy role and applies with `GithubActionsFoundationAccess`, which only the `foundation-dev` or `foundation-prod` GitHub environment can assume, and only from `main` (or a `release/*` branch in prod). In prod the apply waits for the reviewers of `foundation-prod`; in dev it applies after the merge without approval, because the change was already reviewed in its pull request. A plan with no changes applies nothing.

`GithubActionsFoundationAccess` can change only the roles and policies named `GithubActions*`, the OIDC trust and the state backend. It may edit its own policy, so the permissions boundary `CiFoundationBoundary` caps what that policy can grant. A `GithubActions*` role it creates can still carry any policy, so the foundation role is admin by delegation, and the real gate is who may run its apply: the reviewers of `foundation-prod`, and a merge to `main` in dev. An admin created the role and the boundary by hand once in each account; the root then imported the role, and no root CI applies manages the boundary.

The deploy role keeps its broad IAM, S3 and DynamoDB rights for the environment roots, so the foundation root gives it an explicit deny on the CI access that exists today: the existing `GithubActions*` roles and policies, the boundary, the OIDC trust, the state bucket's and lock table's settings, and the foundation root's own state and its digest in the lock table. An environment root cannot change those. It can still create new IAM users and roles; limiting that is OJD-2011's work.

## Review a change

Use OpenTofu to format and validate the configuration in the target environment, then review its plan with the owners of that environment. The repository's [release workflows](../apps/docs/content/developers/contributing/release-workflows.mdx) describe approval and deployment order for dev and prod. The [Centrum status-view cutover runbook](../docs/runbooks/releases/centrum-status-cutover.md) covers its separate release sequence. `pnpm tf` runs `tf:dev`, which initialises and plans dev and never applies. Changes reach AWS only through the release workflows, which apply the plan the approver saw, with the OpenTofu version in `.opentofu-version`. To bump a provider, run `tofu init -upgrade` in each root, then `tofu providers lock -platform=linux_amd64 -platform=darwin_arm64`, and commit the lock files. Those runs sign in to Databricks with GitHub OIDC, through a federation policy on the service principal for each GitHub environment, so the providers' own Databricks credential reaches no saved plan. Plans still carry the backend's Databricks secrets until OJD-2122's second part moves them out. A local plan signs in as you instead: run `databricks auth login --host <workspace URL>` and `databricks auth login --host https://accounts.cloud.databricks.com --account-id <account id>` once, then set `databricks_auth_type = "databricks-cli"` in your local `terraform.tfvars`; `databricks_client_id` is then unused and can be left out. Planning every resource needs workspace and account admin rights; `oauth-m2m` with a service principal's client secret still works but keeps a long-lived secret on your machine.

## Drift

Pull request plans skip the refresh, so a change made outside OpenTofu, in a console or by a script, would otherwise show up only in a release's plan. The Infrastructure Drift workflow (`.github/workflows/drift.yml`) plans the environment root and the foundation of dev and prod against the live resources every night at 04:00 UTC, without a lock and without applying. Dev is compared with `main`, which every merge deploys. Prod is compared, root by root, with the newest `release/<date>` run whose apply of that root succeeded, so merged but unreleased changes, dry runs and app-only releases are not mistaken for drift. The workflow and its actions always come from `main`; only prod's configuration comes from that release.

A root that differs posts its resource addresses, never values, to the environment's `SLACK_WEBHOOK_URL`, at most 40 lines, with the whole list in the run's summary. The plan's own output stays off the public log. A check that fails posts that it failed, and a night without drift posts nothing. Each check uses the environment's deploy identity, because a refresh needs to read every resource, and records no deployment on the environment. A prod release older than a change to the inputs `tofu.yml` passes can need one the check no longer passes; its check then fails and says so until the next release. Run it by hand from `main` in the Actions tab, for one environment or both.

## Secrets

OpenTofu creates the Secrets Manager secrets for authentication, Contentful, Mailchimp, Databricks, SES, Play review sign-in, the serving store's users and the status channel's webhook ([`modules/secrets-manager/container`](modules/secrets-manager/container/main.tf)), and the Databricks secret scopes the pipelines read, but never a credential in them, so no plan or state holds one. A value is set with `pnpm secrets:set <env> <secret> --key <KEY>`, or `pnpm secrets:set <env> status-slack` for the status channel's webhook, which is a single value; both read it from stdin, and [`tooling/devkit/README.md`](../tooling/devkit/README.md#setting-a-secrets-value) lists the secrets and keys. Rotating one is in [`rotate-a-secret`](../docs/runbooks/procedures/rotate-a-secret.md). OpenTofu used to hold these values, so the state bucket's earlier versions and the plan saved for the first apply after the change still contain them. Those copies stay sensitive until each value is rotated and the old one revoked at its source, after OJD-2122; for the Contentful key that waits until no supported mobile release carries it. Identifiers such as the Databricks host, account, client and warehouse ids are not credentials, but this repository and its Actions logs are public, so they stay GitHub secrets, which the logs mask. The PostHog project key and the dev nameservers are public anyway and are committed as defaults. Only the Slack webhooks, the PostHog key Grafana reads with and OpenTofu's own sign-in credentials still pass through it, because the resources that use them hold them; the rotation procedure's last section says how each is limited and rotated.

Production and DR changes need their own reviewed plan and release or recovery procedure. The presence of an `env/dr` directory alone does not establish a live failover target. Keep credentials and state out of Git; the `backend.tf` files name each environment's remote state bucket.
