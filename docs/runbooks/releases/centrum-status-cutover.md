# Centrum status-view cutover

The release that replaces Centrum's status materialized views with plain views needs a manual cutover. OpenTofu creates the new views before the Databricks bundle deploys, so the old materialized views must release their names first. Schedule an owner and a window for the outage. Device status, the devices tab and the heartbeat status collector will fail between the drops and the completed release.

This procedure applies to an environment that still has the old materialized views. Confirm the environment and the current object types before acting; stop if a named object is already a plain view. Do not run these commands from a documentation build or a feature branch.

## Before the release

1. Confirm the selected release ref contains the plain status views, the append-only bridge flows and the `status_views` OpenTofu module. Record the Centrum pipeline ID, target catalog (`open_jii_<env>`), release owner, approval owner and rollback contact.
2. Check the latest successful Centrum update, device status, devices tab and the heartbeat status collector. Record their state so the release can be checked against it. Confirm that the three names below are **materialized views** in the target catalog. A plain view means this migration has already advanced.
3. Arrange the infrastructure and later deployment approvals. Do not start the outage until the release owner can complete the whole sequence.

## Cut over

1. Stop Centrum and wait until the pipeline state is `IDLE`. Verify the pipeline ID and environment before issuing the stop.
2. In the target Databricks catalog, drop only the old materialized views:

   ```sql
   DROP MATERIALIZED VIEW open_jii_<env>.centrum.device_last_activity;
   DROP MATERIALIZED VIEW open_jii_<env>.centrum.experiment_status;
   DROP MATERIALIZED VIEW open_jii_<env>.centrum.experiment_device_data;
   ```

3. Approve the infrastructure gate and the later release gates for the selected ref. OpenTofu creates the replacement plain views; the bundle deploys the changed bridge flows. If OpenTofu reports that a name is still occupied, stop and inspect the object type before proceeding.
4. Full-refresh **only** `bridge_experiment_device` and `bridge_experiment_contributor` after the new bundle is in place. The `DLT pipeline full-refresh` workflow accepts those two table names as its comma-separated `tables` input and handles stopping and restoring continuous mode in prod. The corresponding Databricks CLI selection is:

   ```text
   databricks pipelines start-update <pipeline-id> --json '{"full_refresh_selection":["bridge_experiment_device","bridge_experiment_contributor"],"cause":"API_CALL"}'
   ```

   Use the reviewed release procedure for the target environment. Names in the device data table may be blank until the bridge refresh catches up.

## Verify and recover

Confirm that `device_last_activity`, `experiment_status`, `experiment_device_data_view` and `experiment_table_metadata_view` answer. Check the devices tab, device status and the heartbeat's `GoldMaterializationAgeMinutes` reading. Check the bridge update completes and names fill in. Time the production `/devices/{id}/activity` and experiment `/tables` paths, since the views read source rows at request time.

If a gate fails after the drops, keep the incident owner on the release and restore the status path through the approved release or rollback plan before closing the window. Do not drop another table or full-refresh raw ingestion to force progress. Retired `latest_*` tables can be considered for removal only after status and heartbeat recover.

The driver-memory outcome needs longer observation. Over 6 to 12 hours including 06:00 to 08:00 UTC, compare `Optimize command` counts in the driver log and kept SparkSessions per hour with the pre-release baseline. The expected improvement is near-zero compactions and far fewer kept sessions than the earlier roughly 140 per hour; a successful status-page check alone cannot establish it.
