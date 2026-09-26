# Heartbeat reports
#
# One dashboard per digest, generated from the catalog rather than written beside it.
# The digest and the dashboard therefore read the same entries by construction: a signal
# that is not in the catalog cannot appear here, and one that is active cannot be
# missing. Slack carries the verdict and links the matching report at the right window.
#
# Authenticated on purpose. A Grafana snapshot would be reachable without a login and
# would embed the rendered datapoints and series names permanently, which is the wrong
# trade for a platform that keeps device and experiment identifiers out of CloudWatch.
locals {
  heartbeat_catalog = yamldecode(file("${path.module}/../../../../docs/monitoring/metrics-catalog.yaml"))

  heartbeat_live = [
    for metric in local.heartbeat_catalog.metrics :
    metric if try(metric.active, false) && try(metric.signal, null) != null
  ]

  # Which report each signal belongs to, matching the composer's own filters.
  heartbeat_reports = {
    "overnight-health" = {
      title       = "Overnight health"
      description = "What the daily observability digest read. Exceptions and alerts across the platform."
      from        = "now-24h"
      metrics = [
        for m in local.heartbeat_live : m
        if m.family == "observability" && (contains(m.slots, "exception") || contains(m.slots, "alert"))
      ]
    }
    "daily-pulse" = {
      title       = "Daily pulse"
      description = "What the daily usage digest read. Levels over the last day."
      from        = "now-7d"
      metrics     = [for m in local.heartbeat_live : m if m.family == "usage" && contains(m.slots, "pulse")]
    }
    "week-in-numbers" = {
      title       = "Week in numbers"
      description = "What the weekly note read. Levels over the last week."
      from        = "now-30d"
      metrics     = [for m in local.heartbeat_live : m if contains(m.slots, "weekly")]
    }
  }

  # Two panels per row, in catalog order, so a number cited in Slack is findable here.
  heartbeat_panels = {
    for key, report in local.heartbeat_reports :
    key => [
      for index, metric in report.metrics : {
        type       = "timeseries"
        title      = "${metric.num} · ${metric.name}"
        datasource = { type = "cloudwatch", uid = grafana_data_source.cloudwatch_source.uid }
        gridPos    = { h = 8, w = 12, x = (index % 2) * 12, y = floor(index / 2) * 8 }
        fieldConfig = {
          defaults = {
            custom = { lineWidth = 2, fillOpacity = 8, showPoints = "never" }
            unit   = try(local.heartbeat_units[metric.signal.unit], "short")
            thresholds = {
              mode = "absolute"
              steps = try(metric.baseline.max, null) != null ? [
                { color = "green", value = null },
                { color = "red", value = metric.baseline.max },
              ] : [{ color = "green", value = null }]
            }
          }
        }
        options = { legend = { displayMode = "list", placement = "bottom" } }
        # A SEARCH entry and a plain metric entry differ only in which fields carry the
        # query, so both branches declare the same keys; terraform requires it and
        # Grafana ignores the empty ones.
        targets = [
          {
            refId            = "A"
            id               = "q"
            region           = try(metric.signal.region, var.aws_region)
            namespace        = try(metric.signal.namespace, "")
            statistic        = try(metric.signal.stat, "Average")
            period           = "3600"
            metricQueryType  = 0
            metricEditorMode = try(metric.signal.search, null) != null ? 1 : 0
            expression       = templatestring(try(metric.signal.search, ""), local.heartbeat_placeholders)
            metricName       = try(metric.signal.metric, "")
            matchExact       = try(metric.signal.search, null) == null
            dimensions = try(metric.signal.search, null) != null ? {} : {
              for name, value in try(metric.signal.dimensions, {}) :
              name => templatestring(value, local.heartbeat_placeholders)
            }
          }
        ]
      }
    ]
  }

  # Derived the same way the composer derives them, since a panel built from a different
  # suffix or a shorter function list reports on something the digest never read.
  alb_arn_suffix_heartbeat = element(split("loadbalancer/", var.load_balancer_arn), 1)

  heartbeat_macro_filter = join(" OR ", [
    for name in concat(
      values(var.macro_sandbox_function_names),
      [var.calibration_sandbox_function_name],
    ) : "FunctionName=\"${name}\""
  ])

  # The catalog writes its placeholders in terraform's own template syntax, so the panels
  # resolve them with templatestring rather than a chain of replaces. These are the values
  # the composer's Lambda environment carries, under the same names. A placeholder the
  # digest resolves and the report does not would be a panel querying a literal forever;
  # a name missing here fails the plan instead.
  heartbeat_placeholders = {
    ENVIRONMENT                = var.environment
    KINESIS_STREAM_NAME        = var.kinesis_stream_name
    ALB_ARN_SUFFIX             = local.alb_arn_suffix_heartbeat
    CLOUDFRONT_DISTRIBUTION_ID = var.cloudfront_distribution_id
    SERVER_FUNCTION_NAME       = var.server_function_name
    MACRO_FUNCTION_FILTER      = local.heartbeat_macro_filter
    DB_CLUSTER_IDENTIFIER      = var.db_cluster_identifier
  }

  # Grafana's unit ids for the units the catalog declares.
  heartbeat_units = {
    milliseconds = "ms"
    seconds      = "s"
    minutes      = "m"
    bytes        = "bytes"
    percent      = "percent"
  }
}

resource "grafana_dashboard" "heartbeat" {
  for_each = local.heartbeat_reports

  provider  = grafana.amg
  folder    = grafana_folder.folder.id
  overwrite = true

  config_json = templatefile("${path.module}/heartbeat.json.tftpl", {
    uid          = "${var.environment}-heartbeat-${each.key}"
    title        = "${each.value.title} · ${var.environment}"
    description  = each.value.description
    report       = each.key
    default_from = each.value.from
    panels       = jsonencode(local.heartbeat_panels[each.key])
  })
}

output "heartbeat_report_uids" {
  description = "Dashboard uid per report, so the composer can link the right one"
  value       = { for key in keys(local.heartbeat_reports) : key => "${var.environment}-heartbeat-${key}" }
}
