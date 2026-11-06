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

A release runs the Foundation workflow before the infrastructure deploy whenever `foundation/` or the `iam-oidc`, `s3` or `dynamodb` modules change, and on a run with no previous push to compare against, such as a manual dispatch. It plans with the environment's deploy role and applies with `GithubActionsFoundationAccess`, which only the `foundation-dev` or `foundation-prod` GitHub environment can assume, and only from `main` (or a `release/*` branch in prod). In prod the apply waits for the reviewers of `foundation-prod`; in dev it applies after the merge without approval, because the change was already reviewed in its pull request. A plan with no changes applies nothing.

`GithubActionsFoundationAccess` can change only the roles and policies named `GithubActions*`, the OIDC trust and the state backend. It may edit its own policy, so the permissions boundary `CiFoundationBoundary` caps what that policy can grant. An admin created the role and the boundary by hand once in each account; the root then imported the role, and no root CI applies manages the boundary.

The deploy role keeps its broad IAM, S3 and DynamoDB rights for the environment roots, so the foundation root gives it an explicit deny on everything above: the `GithubActions*` roles and policies, the boundary, the OIDC trust, the state bucket's and lock table's settings, and the foundation root's own state. An environment root therefore cannot change CI's access, even by declaring a new resource for it.

## Review a change

Use OpenTofu to format and validate the configuration in the target environment, then review its plan with the owners of that environment. The repository's [release workflows](../apps/docs/content/developers/contributing/release-workflows.mdx) describe approval and deployment order for dev and prod. The [Centrum status-view cutover runbook](../docs/runbooks/releases/centrum-status-cutover.md) covers its separate release sequence. `pnpm tf` runs `tf:dev`, which initialises and plans dev and never applies. Changes reach AWS only through the release workflows, which apply the plan the approver saw, with OpenTofu 1.12 or later. Those runs sign in to Databricks with GitHub OIDC, through a federation policy on the service principal for each GitHub environment, so no Databricks secret reaches a saved plan. A local plan still uses the client secret from your variables.

Production and DR changes need their own reviewed plan and release or recovery procedure. The presence of an `env/dr` directory alone does not establish a live failover target. Keep credentials and state out of Git; the `backend.tf` files name each environment's remote state bucket.
