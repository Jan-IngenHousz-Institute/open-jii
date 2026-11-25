# Bundle move preparation

The release that prepares the Databricks bundle to own the pipelines and jobs does two things that need a person. It moves the three pipelines off legacy publishing mode, which cannot be undone. It also moves the classic pipelines and the store reload from wheels installed by their cluster policies to wheels in their own environment. Run it on dev first and on prod in a release of its own. The move itself follows once this release has run on both environments.

## Before the release

1. Confirm that the environment's `DATABRICKS_GHA_CLIENT_ID` is the application id of `github-cicd-service-principal-<env>`. The release gives that principal `CAN_MANAGE` on every pipeline and job, `CAN_USE` on the three cluster policies, and the Service Principal User role on the node principal.
2. Confirm that `terraform-cicd-<env>` is in the workspace `admins` group. The release hands ownership of every pipeline and job to the node principal, and OpenTofu keeps managing them only through that group.
3. Read the rule set of `node-service-principal-<env>`, in the account console under the principal's permissions or with the API. The account id is the `DATABRICKS_ACCOUNT_ID` secret, and `system.access.audit` also carries it.

   ```text
   databricks api get "/api/2.0/preview/accounts/access-control/rule-sets?name=accounts/<account-id>/servicePrincipals/<node-app-id>/ruleSets/default&etag="
   ```

   The release replaces it with three grants: Manager for the OpenTofu principal, and User for the OpenTofu principal and `github-cicd-service-principal-<env>`. Before releasing, add to `databricks_access_control_rule_set.node_service_principal` any other principal that still relies on its grant. A person's User grant can go, because it is only needed to save a pipeline or job that runs as the node principal by hand.

4. Confirm that each of the three pipelines has run an update in the last 60 days, which the migration requires.

## During the release

1. Stop Centrum and the macro pipeline before approving the OpenTofu apply, and wait until both are `IDLE`. The migration expects the pipeline to be stopped when the flag lands ([migrate to the default publishing mode](https://docs.databricks.com/aws/en/ldp/migrate-to-dpm)). The metrics pipeline gets the flag too, and its scheduler starts it every hour, so approve once that hour's update has finished and it is `IDLE` as well.
2. Approve the OpenTofu apply. It adds `pipelines.enableDPMForExistingPipeline` to the three pipelines, moves the wheels into the pipelines' environment and the store reload's task, makes the node principal the owner of every pipeline and job, and adds the rule set.
3. The first update of each pipeline after the apply runs the migration. If Centrum or macro is still `IDLE` a few minutes after the apply, start it with `databricks pipelines start-update <pipeline-id>`. Run `Metrics-Pipeline-Scheduler-<ENV>` once instead of waiting for the hour.
4. Nothing under `apps/data` changes, so on dev change detection skips the Databricks deploy, and the new CLI and its plan check would first run on an unrelated change. Run `DEV Release Workflow` with `deploy_app=databricks` once the merge's run has finished. A prod release deploys every app, Databricks included, so it needs nothing extra.

## Verify

1. `databricks pipelines get <pipeline-id> -o json | jq '.spec | {schema, target}'` shows `schema` set and no `target` for all three pipelines.
2. Centrum and macro run their flows, gold tables advance, and the metrics run completes.
3. On dev, run `Serving-Store-Reload-DEV` for one experiment, which proves its task installs the wheels.
4. The Databricks deploy passes its plan check and uploads the four wheels to `artifacts/.internal`.

## If something fails

The publishing-mode migration has no rollback, so fix forward.

If Centrum or macro fails to import `openjii`, `enrich` or `data_repair`, the wheel change is the cause. Revert the `environment_dependencies`, task `libraries` and policy `libraries` change on main and release it. The flag stays, and the migration completes on the next update.

If the Databricks deploy fails its plan check, nothing was applied. The step names the keys that would have been deleted, recreated or duplicated.
