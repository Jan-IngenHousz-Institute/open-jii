# Bundle owns the pipelines and jobs

The release that moves the three pipelines and seven jobs from OpenTofu into the Databricks bundle has one step a person does by hand: binding each live resource to its bundle key, so the bundle adopts it and creates nothing. It is one-way in state. Run it on dev first, and on prod in a release that carries nothing else large.

## Before the release

1. The preparation release ([bundle-move-prep](bundle-move-prep.md)) is live on this environment, and all three pipelines report `schema` and no `target`.
2. The backend triggers uploads and exports by job name.
3. On dev, stop merging changes under `apps/data` until the deploy in step 5 of the next section has finished.
4. On prod, give the `prod` target its `workspace_id` in `apps/data/databricks.yml`. It is the number in the workspace's URL after `?o=`.
5. On dev, once before the first bind, rehearse with a throwaway job in a scratch target that uses the same root layout: bind and unbind it as yourself, then let CI deploy it. This proves the CI principal's home accepts both identities and that the stamped wheel names install.

## Bind and release

Work from the release ref in `apps/data`, signed in to the environment's workspace as yourself.

1. Export the two code versions and validate.

   ```text
   export BUNDLE_VAR_centrum_code_version=$(git rev-parse --short=12 HEAD:./src/pipelines/centrum)
   export BUNDLE_VAR_macro_code_version=$(git rev-parse --short=12 HEAD:./src/pipelines/macros)
   databricks bundle validate -t <env>
   ```

2. Bind each of the ten keys to the live resource with its name, and read the diff each bind prints. A bind writes bundle state under the new root and changes nothing else.

   ```text
   databricks pipelines list-pipelines -o json | jq -r '.[] | "\(.name)\t\(.pipeline_id)"'
   databricks jobs list -o json | jq -r '.[] | "\(.settings.name)\t\(.job_id)"'
   databricks bundle deployment bind <key> <id> -t <env>
   ```

   | Key                          | Name                                 |
   | ---------------------------- | ------------------------------------ |
   | `centrum`                    | `Centrum-DLT-Pipeline-<ENV>`         |
   | `macro`                      | `Macro-Execution-DLT-Pipeline-<ENV>` |
   | `metrics`                    | `Metrics-DLT-Pipeline-<ENV>`         |
   | `metrics_pipeline_scheduler` | `Metrics-Pipeline-Scheduler-<ENV>`   |
   | `metrics_heartbeat_export`   | `Metrics-Heartbeat-Export-<ENV>`     |
   | `centrum_backup`             | `Centrum-Backup-Job-<ENV>`           |
   | `data_upload`                | `Data-Upload-Job-<ENV>`              |
   | `data_export`                | `Data-Export-Job-<ENV>`              |
   | `project_transfer`           | `Project-Transfer-Job-<ENV>`         |
   | `serving_store_reload`       | `Serving-Store-Reload-<ENV>`         |

3. Run `databricks bundle plan -t <env>`. Every key shows `update` or `skip`, and none shows `create`, `delete` or `recreate`. The changes are the ones the move makes: notebook paths and wheels under the new root, the code version, the dropped `pipeline.*` keys and publishing-mode flag, and on dev the metrics pipeline leaving development mode.
4. Merge the pull request on dev, or start the release on prod. Approve the OpenTofu apply only if its plan forgets ten modules and destroys nothing. Besides the forgets it removes the two job id keys from the backend's secret and task definition.
5. The Databricks deploy follows the apply. It uploads to the new root and updates the ten resources in place, and Centrum and macro each restart once. If the deploy does not finish green, run it again at once with `deploy_app=databricks`: between the apply and the deploy nothing manages the pipelines.

## Verify

1. `databricks bundle summary -t <env>` lists the same ten ids as before.
2. Centrum and macro are running a new update and the gold tables advance.
3. A second deploy plans `skip` for every key.
4. On dev, an upload and an export from the web app both run.
5. `Project-Transfer-Job-<ENV>` still has its table trigger, and the next heartbeat run reports costs.
6. The new root's permissions show the CI principal and the node principal only.
7. Delete the old `/Workspace/Shared/.bundle/open-jii/<env>` folder.

## If something fails

Before step 4, `databricks bundle deployment unbind <key> -t <env>` undoes a bind and touches only state.

After the apply, roll forward. A pipeline that fails to start names what it could not find, usually a notebook path or a wheel, and the next deploy carries the fix.

From this release on, reject any OpenTofu plan that adds a `databricks_pipeline` or a `databricks_job`. A ref from before the move would create all ten again beside the live ones.
