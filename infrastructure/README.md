# openJII infrastructure

OpenJII's cloud resources are declared with OpenTofu. Environment compositions live under `infrastructure/env/`; reusable modules live under `infrastructure/modules/`.

| Composition | Region in `variables.tf` | Purpose                                                                                                                                                                                                                                        |
| ----------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `env/dev`   | `eu-central-1`           | Development services and data paths.                                                                                                                                                                                                           |
| `env/prod`  | `eu-central-1`           | Production services and data paths, including cross-region backup configuration.                                                                                                                                                               |
| `env/dr`    | `eu-west-1`              | Disaster recovery configuration. It references some production resources and creates traffic-switching DNS records only when its cutover input is enabled. This directory establishes configuration, not evidence that a DR stack is deployed. |

Each composition has its own `main.tf`, variables and S3 state backend. There is no `env/staging` directory. Read the target environment's files before changing a module or interpreting a plan.

## Repository map

```text
infrastructure/
├── env/
│   ├── dev/
│   ├── prod/
│   └── dr/
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

## Review a change

Use OpenTofu to format and validate the configuration in the target environment, then review its plan with the owners of that environment. The repository's [release workflows](../apps/docs/content/developers/contributing/release-workflows.mdx) describe approval and deployment order for dev and prod. The [Centrum status-view cutover runbook](../docs/runbooks/releases/centrum-status-cutover.md) covers its separate release sequence. Do not treat `pnpm tf` as a read-only check: `package.json` points it at `tf:dev`, which includes `tofu apply`.

Production and DR changes need their own reviewed plan and release or recovery procedure. The presence of an `env/dr` directory alone does not establish a live failover target. Keep credentials and state out of Git; the `backend.tf` files name each environment's remote state bucket.
