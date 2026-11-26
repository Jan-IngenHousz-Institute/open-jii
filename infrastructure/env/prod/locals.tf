locals {
  # The pipeline wheels, installed through the cluster policies.
  pipeline_libraries = [
    {
      whl = "/Workspace/Shared/.bundle/open-jii/${var.environment}/artifacts/.internal/enrich-0.1.0-py3-none-any.whl"
    },
    {
      whl = "/Workspace/Shared/.bundle/open-jii/${var.environment}/artifacts/.internal/openjii-0.1.0-py3-none-any.whl"
    },
    {
      whl = "/Workspace/Shared/.bundle/open-jii/${var.environment}/artifacts/.internal/data_repair-0.1.0-py3-none-any.whl"
    }
  ]

  # Each consumer's webhook stays in state, because the resource that posts with it holds it. A
  # webhook per consumer keeps a leaked one to one consumer's channel (rotate-a-secret.md).
  slack_webhooks = {
    databricks = var.slack_webhook_url_databricks != "" ? var.slack_webhook_url_databricks : var.slack_webhook_url
    grafana    = var.slack_webhook_url_grafana != "" ? var.slack_webhook_url_grafana : var.slack_webhook_url
  }

  databricks_cost_components = {
    centrum        = { dlt_pipeline_id = module.centrum_pipeline.pipeline_id }
    macro          = { dlt_pipeline_id = module.macro_execution_pipeline.pipeline_id }
    metrics        = { dlt_pipeline_id = module.metrics_pipeline.pipeline_id }
    warehouse      = { warehouse_id = var.backend_databricks_warehouse_id }
    investigations = { warehouse_id = module.investigations_warehouse.warehouse_id }
  }

  # The version each feed sink starts at when its checkpoint is new, as in dev. Empty keeps the feed
  # and its alerts off; switching on means filling in every table dev lists, each gold table's
  # version read from gold on the day they ship (docs/runbooks/store-feed-stalled.md).
  serving_store_feed_start_versions = {}
  serving_store_feed                = length(local.serving_store_feed_start_versions) > 0

  # Only while the feed is on do the pipelines carry it: a settings change starts a pipeline
  # before a release has deployed the notebook.
  centrum_feed_notebooks = local.serving_store_feed ? ["/Workspace/Shared/.bundle/open-jii/prod/notebooks/src/pipelines/centrum/serving_store_feed"] : []
  macro_feed_notebooks   = local.serving_store_feed ? ["/Workspace/Shared/.bundle/open-jii/prod/notebooks/src/pipelines/macros/serving_store_feed"] : []
  serving_store_feed_settings = {
    for table, version in local.serving_store_feed_start_versions :
    "SERVING_STORE_FEED_START_${upper(table)}" => version if version != ""
  }

  # Needs the centrum pipeline that drops health checks from raw_data to be running here.
  ingest_healthcheck_publishing = true

  # The pipeline carries the notebook only while publishing is on: a settings change starts it before
  # a release has deployed a new notebook.
  ingest_healthcheck_notebooks = local.ingest_healthcheck_publishing ? ["/Workspace/Shared/.bundle/open-jii/prod/notebooks/src/pipelines/centrum/bronze/ingest_healthchecks"] : []

  # Needs a HealthcheckAgeMinutes datapoint here: the stalled rule fires on no data.
  ingest_healthcheck_alerting = true

  # Whether this environment posts to the status Slack channel. The webhook is set with
  # `pnpm secrets:set prod status-slack`.
  status_slack_enabled = false

  # Under databricks-cli the CLI's own login signs in, as the person running the plan.
  databricks_client_id = var.databricks_auth_type == "databricks-cli" ? null : var.databricks_client_id
}
