terraform {
  required_providers {
    grafana = {
      source                = "grafana/grafana"
      version               = ">= 4.2.1"
      configuration_aliases = [grafana.amg]
    }
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  # Explore on one log group, filtered to the lines that share one id: a backend request's, or an
  # IoT message's trace. __ID__ is where each link puts the id its row carries.
  log_explore_urls = {
    for key, group in {
      backend = { name = var.ecs_log_group_name, field = "req.id" }
      iot     = { name = var.iot_log_group_name, field = "traceId" }
      } : key => replace(replace(
        "/explore?schemaVersion=1&orgId=1&panes=${urlencode(jsonencode({
          logs = {
            datasource = grafana_data_source.cloudwatch_logs_source.uid
            range      = { from = "__FROM__", to = "__TO__" }
            queries = [{
              refId       = "A"
              datasource  = { type = "cloudwatch", uid = grafana_data_source.cloudwatch_logs_source.uid }
              queryMode   = "Logs"
              region      = var.aws_region
              statsGroups = []
              expression  = "fields @timestamp, @message | filter ${group.field} = \"__ID__\" | sort @timestamp asc"
              logGroups = [{
                accountId = data.aws_caller_identity.current.account_id
                arn       = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:${group.name}:*"
                name      = group.name
              }]
            }]
          }
        }))}",
    "__FROM__", "$${__from}"), "__TO__", "$${__to}")
  }

  dashboard_vars = {
    backend_request_logs_url           = replace(local.log_explore_urls.backend, "__ID__", "$${__data.fields.request}")
    iot_trace_logs_url                 = replace(local.log_explore_urls.iot, "__ID__", "$${__data.fields.trace}")
    datasource_uid                     = grafana_data_source.cloudwatch_source.uid
    logs_datasource_uid                = grafana_data_source.cloudwatch_logs_source.uid
    project                            = var.project
    environment                        = var.environment
    aws_region                         = var.aws_region
    cloudfront_distribution_id         = var.cloudfront_distribution_id
    load_balancer_dimension            = join("/", slice(split("/", var.load_balancer_arn), 1, length(split("/", var.load_balancer_arn))))
    target_group_dimension             = element(split(":", var.target_group_arn), length(split(":", var.target_group_arn)) - 1)
    ecs_cluster_name                   = var.ecs_cluster_name
    ecs_service_name                   = var.ecs_service_name
    server_function_name               = var.server_function_name
    db_cluster_identifier              = var.db_cluster_identifier
    kinesis_stream_name                = var.kinesis_stream_name
    kinesis_shard_count                = var.kinesis_shard_count
    ecs_log_group_name                 = var.ecs_log_group_name
    iot_log_group_name                 = var.iot_log_group_name
    account_id                         = data.aws_caller_identity.current.account_id
    macro_sandbox_python_function_name = lookup(var.macro_sandbox_function_names, "python", "")
    macro_sandbox_js_function_name     = lookup(var.macro_sandbox_function_names, "js", "")
    macro_sandbox_r_function_name      = lookup(var.macro_sandbox_function_names, "r", "")
    calibration_sandbox_function_name  = var.calibration_sandbox_function_name
    route53_health_check_id            = var.route53_health_check_id
  }
}

# Create a CloudWatch data source in AMG
resource "grafana_data_source" "cloudwatch_source" {
  provider   = grafana.amg
  type       = "cloudwatch"
  name       = "cw-datasource"
  is_default = true

  json_data_encoded = jsonencode({
    defaultRegion = var.aws_region
    authType      = "default" # AMG uses SigV4 with the workspace role
  })
}

# Create a separate CloudWatch Logs data source for log queries
resource "grafana_data_source" "cloudwatch_logs_source" {
  provider   = grafana.amg
  type       = "cloudwatch"
  name       = "cw-logs-datasource"
  is_default = false

  json_data_encoded = jsonencode({
    defaultRegion = var.aws_region
    authType      = "default"
    logGroupNames = [var.ecs_log_group_name]
  })
}

# PostHog through the Infinity plugin, for the errors it groups into issues. The key is
# read-only and only ever sent to PostHog.
resource "grafana_data_source" "posthog" {
  count = var.posthog_grafana_api_key == "" ? 0 : 1

  provider = grafana.amg
  type     = "yesoreyeram-infinity-datasource"
  name     = "posthog"

  json_data_encoded = jsonencode({
    auth_method  = "bearerToken"
    allowedHosts = ["https://eu.posthog.com"]
  })

  secure_json_data_encoded = jsonencode({
    bearerToken = var.posthog_grafana_api_key
  })
}

resource "grafana_folder" "folder" {
  provider = grafana.amg
  title    = "${var.environment} Dashboards"
  uid      = "${var.environment}-dashboards"
}

### Alerting rules 

resource "grafana_contact_point" "slack" {
  provider = grafana.amg
  name     = "slack"

  slack {
    url = var.slack_webhook_url
  }

  lifecycle {
    ignore_changes = [slack]
  }
}


# ============================================================================
# ALERT RULES - Standard monitoring
# ============================================================================

# Backend API Alerts
resource "grafana_rule_group" "backend_alerts" {
  provider           = grafana.amg
  name               = "Backend API Alerts"
  folder_uid         = grafana_folder.folder.uid
  interval_seconds   = 60
  disable_provenance = true

  rule {
    name      = "Backend High CPU Usage"
    condition = "C"

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      model = jsonencode({
        refId      = "A"
        region     = var.aws_region
        namespace  = "AWS/ECS"
        metricName = "CPUUtilization"
        statistic  = "Average"
        dimensions = {
          ClusterName = var.ecs_cluster_name
          ServiceName = var.ecs_service_name
        }
      })

      relative_time_range {
        from = 300
        to   = 0
      }
    }

    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "__expr__"

      model = <<EOT
{"conditions":[{"evaluator":{"params":[0,0],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"params":[],"type":"last"},"type":"query"}],"datasource":{"name":"Expression","type":"__expr__","uid":"__expr__"},"expression":"A","hide":false,"intervalMs":1000,"maxDataPoints":43200,"reducer":"last","refId":"B","type":"reduce"}
EOT

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    data {
      ref_id         = "C"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "$B > 80"
        type       = "math"
        refId      = "C"
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    no_data_state  = "NoData"
    exec_err_state = "OK"
    for            = "5m"

    annotations = {
      description      = "Backend ECS service CPU usage is above 80%"
      summary          = "High CPU usage on backend service"
      runbook_url      = "${var.runbook_base_url}/docs/runbooks/api-cpu.md"
      __dashboardUid__ = local.heartbeat_daily_uid
      __panelId__      = local.heartbeat_panel_ids["api-cpu"]
    }
    labels = {
      metric_id = "api-cpu"
      severity  = "warning"
      service   = "backend"
    }
  }

  rule {
    name      = "Backend Service Unhealthy"
    condition = "C"

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      model = jsonencode({
        refId      = "A"
        region     = var.aws_region
        namespace  = "AWS/ApplicationELB"
        metricName = "UnHealthyHostCount"
        statistic  = "Maximum"
        dimensions = {
          TargetGroup  = local.dashboard_vars.target_group_dimension
          LoadBalancer = local.dashboard_vars.load_balancer_dimension
        }
      })

      relative_time_range {
        from = 300
        to   = 0
      }
    }

    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "__expr__"

      model = <<EOT
{"conditions":[{"evaluator":{"params":[0,0],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"params":[],"type":"last"},"type":"query"}],"datasource":{"name":"Expression","type":"__expr__","uid":"__expr__"},"expression":"A","hide":false,"intervalMs":1000,"maxDataPoints":43200,"reducer":"last","refId":"B","type":"reduce"}
EOT

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    data {
      ref_id         = "C"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "$B > 0"
        type       = "math"
        refId      = "C"
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    no_data_state  = "OK"
    exec_err_state = "OK"
    for            = "2m"

    annotations = {
      description      = "Unhealthy targets detected in backend service"
      summary          = "Backend service has unhealthy targets"
      runbook_url      = "${var.runbook_base_url}/docs/runbooks/api-hosts-unhealthy.md"
      __dashboardUid__ = local.heartbeat_daily_uid
      __panelId__      = local.heartbeat_panel_ids["api-hosts-unhealthy"]
    }
    labels = {
      metric_id = "api-hosts-unhealthy"
      severity  = "critical"
      service   = "backend"
    }
  }

  rule {
    name      = "Backend High 5xx Error Rate"
    condition = "C"

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      model = jsonencode({
        refId            = "A"
        region           = var.aws_region
        namespace        = "AWS/ApplicationELB"
        metricName       = "HTTPCode_Target_5XX_Count"
        statistic        = "Sum"
        period           = "300"
        matchExact       = true
        metricEditorMode = 0
        metricQueryType  = 0
        queryMode        = "Metrics"
        dimensions = {
          LoadBalancer = [local.dashboard_vars.load_balancer_dimension]
        }
      })

      relative_time_range {
        from = 300
        to   = 0
      }
    }

    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "__expr__"

      model = <<EOT
{"conditions":[{"evaluator":{"params":[0,0],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"params":[],"type":"sum"},"type":"query"}],"datasource":{"name":"Expression","type":"__expr__","uid":"__expr__"},"expression":"A","hide":false,"intervalMs":1000,"maxDataPoints":43200,"reducer":"sum","refId":"B","type":"reduce"}
EOT

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    data {
      ref_id         = "C"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "$B > 5"
        type       = "math"
        refId      = "C"
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    no_data_state  = "OK"
    exec_err_state = "OK"
    for            = "5m"

    annotations = {
      description      = "Backend is returning 5xx errors"
      summary          = "5xx errors detected on backend service"
      runbook_url      = "${var.runbook_base_url}/docs/runbooks/backend-5xx.md"
      __dashboardUid__ = local.heartbeat_daily_uid
      __panelId__      = local.heartbeat_panel_ids["backend-5xx"]
    }
    labels = {
      metric_id = "backend-5xx"
      severity  = "warning"
      service   = "backend"
    }
  }
}

# CloudFront Alerts
resource "grafana_rule_group" "cloudfront_errors" {
  provider         = grafana.amg
  name             = "CloudFront Errors"
  folder_uid       = grafana_folder.folder.uid
  interval_seconds = 60

  rule {
    name      = "Site Down - High CloudFront 5xx Rate"
    condition = "C"

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      model = jsonencode({
        refId      = "A"
        region     = "us-east-1"
        namespace  = "AWS/CloudFront"
        metricName = "5xxErrorRate"
        statistic  = "Average"
        dimensions = {
          DistributionId = var.cloudfront_distribution_id
          Region         = "Global"
        }
      })

      relative_time_range {
        from = 300
        to   = 0
      }
    }

    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "A"
        type       = "reduce"
        reducer    = "last"
        refId      = "B"
        settings = {
          mode             = "replaceNN"
          replaceWithValue = 0
        }
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    data {
      ref_id         = "C"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "$B > 5"
        type       = "math"
        refId      = "C"
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    no_data_state  = "NoData"
    exec_err_state = "OK"
    for            = "1m"

    annotations = {
      description      = "CloudFront 5xx error rate is above 5%, so the origin may be down"
      summary          = "Site may be down: high 5xx rate on CloudFront"
      runbook_url      = "${var.runbook_base_url}/docs/runbooks/cloudfront-errors.md"
      __dashboardUid__ = local.heartbeat_daily_uid
      __panelId__      = local.heartbeat_panel_ids["cloudfront-errors"]
    }
    labels = {
      metric_id = "cloudfront-errors"
      severity  = "critical"
      service   = "frontend"
    }
  }
}

# Site Availability Alerts (active Route53 health check probe)
resource "grafana_rule_group" "site_availability" {
  count = var.enable_site_availability_alert ? 1 : 0

  provider           = grafana.amg
  name               = "Site Availability"
  folder_uid         = grafana_folder.folder.uid
  interval_seconds   = 60
  disable_provenance = true

  rule {
    name      = "Site Down - Health Check Failing"
    condition = "C"

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      model = jsonencode({
        refId      = "A"
        region     = "us-east-1"
        namespace  = "AWS/Route53"
        metricName = "HealthCheckStatus"
        statistic  = "Minimum"
        period     = "60"
        dimensions = {
          HealthCheckId = var.route53_health_check_id
        }
      })

      relative_time_range {
        from = 300
        to   = 0
      }
    }

    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "A"
        type       = "reduce"
        reducer    = "last"
        refId      = "B"
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    data {
      ref_id         = "C"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "$B < 1"
        type       = "math"
        refId      = "C"
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    no_data_state  = "Alerting"
    exec_err_state = "Alerting"
    for            = "1m"

    annotations = {
      description      = "Route53 health check reports the site is unreachable"
      summary          = "Site is down: active health check failing"
      runbook_url      = "${var.runbook_base_url}/docs/runbooks/site-up.md"
      __dashboardUid__ = local.heartbeat_daily_uid
      __panelId__      = local.heartbeat_panel_ids["site-up"]
    }
    labels = {
      metric_id = "site-up"
      severity  = "critical"
      service   = "frontend"
    }
  }
}

# Lambda Alerts (using CloudWatch fill for missing data)
resource "grafana_rule_group" "lambda_health" {
  provider         = grafana.amg
  name             = "Lambda Health"
  folder_uid       = grafana_folder.folder.uid
  interval_seconds = 60

  rule {
    name      = "Lambda High Error Rate"
    condition = "C"

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      model = jsonencode({
        refId      = "A"
        region     = var.aws_region
        namespace  = "AWS/Lambda"
        metricName = "Errors"
        statistic  = "Sum"
        dimensions = {
          FunctionName = var.server_function_name
        }
      })

      relative_time_range {
        from = 300
        to   = 0
      }
    }

    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "__expr__"

      model = <<EOT
{"conditions":[{"evaluator":{"params":[0,0],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"params":[],"type":"sum"},"type":"query"}],"datasource":{"name":"Expression","type":"__expr__","uid":"__expr__"},"expression":"A","hide":false,"intervalMs":1000,"maxDataPoints":43200,"reducer":"sum","refId":"B","type":"reduce"}
EOT

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    data {
      ref_id         = "C"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "$B > 5"
        type       = "math"
        refId      = "C"
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    no_data_state  = "OK"
    exec_err_state = "OK"
    for            = "1m"

    annotations = {
      description      = "Server Lambda has more than 5 errors in the last 5 minutes, so the site may be down"
      summary          = "Site may be down: Server Lambda errors detected"
      runbook_url      = "${var.runbook_base_url}/docs/runbooks/opennext-lambda-errors.md"
      __dashboardUid__ = local.heartbeat_daily_uid
      __panelId__      = local.heartbeat_panel_ids["opennext-lambda-errors"]
    }
    labels = {
      metric_id = "opennext-lambda-errors"
      severity  = "warning"
      service   = "frontend"
    }
  }

  rule {
    name      = "Lambda Throttling"
    condition = "C"

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      model = jsonencode({
        refId      = "A"
        region     = var.aws_region
        namespace  = "AWS/Lambda"
        metricName = "Throttles"
        statistic  = "Sum"
        dimensions = {
          FunctionName = var.server_function_name
        }
      })

      relative_time_range {
        from = 300
        to   = 0
      }
    }

    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "__expr__"

      model = <<EOT
{"conditions":[{"evaluator":{"params":[0,0],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"params":[],"type":"sum"},"type":"query"}],"datasource":{"name":"Expression","type":"__expr__","uid":"__expr__"},"expression":"A","hide":false,"intervalMs":1000,"maxDataPoints":43200,"reducer":"sum","refId":"B","type":"reduce"}
EOT

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    data {
      ref_id         = "C"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "$B > 0"
        type       = "math"
        refId      = "C"
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    no_data_state  = "OK"
    exec_err_state = "OK"
    for            = "5m"

    annotations = {
      description      = "Lambda function is being throttled"
      summary          = "Lambda throttling detected"
      runbook_url      = "${var.runbook_base_url}/docs/runbooks/web-server-throttles.md"
      __dashboardUid__ = local.heartbeat_daily_uid
      __panelId__      = local.heartbeat_panel_ids["web-server-throttles"]
    }
    labels = {
      metric_id = "web-server-throttles"
      severity  = "warning"
      service   = "lambda"
    }
  }
}

# Database Alerts
resource "grafana_rule_group" "database_health" {
  provider         = grafana.amg
  name             = "Database Health"
  folder_uid       = grafana_folder.folder.uid
  interval_seconds = 60

  rule {
    name      = "Database High CPU"
    condition = "C"

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      model = jsonencode({
        refId      = "A"
        region     = var.aws_region
        namespace  = "AWS/RDS"
        metricName = "CPUUtilization"
        statistic  = "Average"
        dimensions = {
          DBClusterIdentifier = var.db_cluster_identifier
        }
      })

      relative_time_range {
        from = 300
        to   = 0
      }
    }

    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "__expr__"

      model = <<EOT
{"conditions":[{"evaluator":{"params":[0,0],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"params":[],"type":"last"},"type":"query"}],"datasource":{"name":"Expression","type":"__expr__","uid":"__expr__"},"expression":"A","hide":false,"intervalMs":1000,"maxDataPoints":43200,"reducer":"last","refId":"B","type":"reduce"}
EOT

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    data {
      ref_id         = "C"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "$B > 80"
        type       = "math"
        refId      = "C"
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    no_data_state  = "NoData"
    exec_err_state = "OK"
    for            = "5m"

    annotations = {
      description      = "Database CPU usage is above 80% "
      summary          = "High CPU usage on database cluster"
      runbook_url      = "${var.runbook_base_url}/docs/runbooks/database-cpu.md"
      __dashboardUid__ = local.heartbeat_daily_uid
      __panelId__      = local.heartbeat_panel_ids["database-cpu"]
    }
    labels = {
      metric_id = "database-cpu"
      severity  = "warning"
      service   = "database"
    }
  }

  rule {
    name      = "Database High Connections"
    condition = "C"

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      model = jsonencode({
        refId      = "A"
        region     = var.aws_region
        namespace  = "AWS/RDS"
        metricName = "DatabaseConnections"
        statistic  = "Average"
        dimensions = {
          DBClusterIdentifier = var.db_cluster_identifier
        }
      })

      relative_time_range {
        from = 300
        to   = 0
      }
    }

    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "A"
        type       = "reduce"
        reducer    = "last"
        refId      = "B"
        settings = {
          mode             = "replaceNN"
          replaceWithValue = 0
        }
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    data {
      ref_id         = "C"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "$B > 80"
        type       = "math"
        refId      = "C"
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    no_data_state  = "OK"
    exec_err_state = "OK"
    for            = "5m"

    annotations = {
      description      = "Database has high number of active connections (threshold: 80)"
      summary          = "High number of database connections"
      runbook_url      = "${var.runbook_base_url}/docs/runbooks/database-connections.md"
      __dashboardUid__ = local.heartbeat_daily_uid
      __panelId__      = local.heartbeat_panel_ids["database-connections"]
    }
    labels = {
      metric_id = "database-connections"
      severity  = "warning"
      service   = "database"
    }
  }
}

# Macro Sandbox Alerts
resource "grafana_rule_group" "macro_sandbox_health" {
  count = length(var.macro_sandbox_function_names) > 0 ? 1 : 0

  provider           = grafana.amg
  name               = "Macro Sandbox Health"
  folder_uid         = grafana_folder.folder.uid
  interval_seconds   = 60
  disable_provenance = true

  dynamic "rule" {
    for_each = var.macro_sandbox_function_names
    content {
      name      = "Macro Sandbox ${rule.key} Errors"
      condition = "C"

      data {
        ref_id         = "A"
        query_type     = ""
        datasource_uid = grafana_data_source.cloudwatch_source.uid

        model = jsonencode({
          refId      = "A"
          region     = var.aws_region
          namespace  = "AWS/Lambda"
          metricName = "Errors"
          statistic  = "Sum"
          period     = "300"
          dimensions = {
            FunctionName = rule.value
          }
        })

        relative_time_range {
          from = 300
          to   = 0
        }
      }

      data {
        ref_id         = "B"
        query_type     = ""
        datasource_uid = "__expr__"

        model = <<EOT
{"conditions":[{"evaluator":{"params":[0,0],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"params":[],"type":"sum"},"type":"query"}],"datasource":{"name":"Expression","type":"__expr__","uid":"__expr__"},"expression":"A","hide":false,"intervalMs":1000,"maxDataPoints":43200,"reducer":"sum","refId":"B","type":"reduce"}
EOT

        relative_time_range {
          from = 0
          to   = 0
        }
      }

      data {
        ref_id         = "C"
        query_type     = ""
        datasource_uid = "__expr__"

        model = jsonencode({
          expression = "$B > 10"
          type       = "math"
          refId      = "C"
        })

        relative_time_range {
          from = 0
          to   = 0
        }
      }

      no_data_state  = "OK"
      exec_err_state = "OK"
      for            = "5m"

      annotations = {
        description      = "Macro sandbox ${rule.key} Lambda has more than 10 errors in the last 5 minutes"
        summary          = "Macro sandbox ${rule.key} error rate high"
        runbook_url      = "${var.runbook_base_url}/docs/runbooks/sandbox-errors.md"
        __dashboardUid__ = local.heartbeat_daily_uid
        __panelId__      = local.heartbeat_panel_ids["sandbox-errors"]
      }
      labels = {
        metric_id = "sandbox-errors"
        severity  = "warning"
        service   = "macro-sandbox"
      }
    }
  }

  dynamic "rule" {
    for_each = var.macro_sandbox_function_names
    content {
      name      = "Macro Sandbox ${rule.key} Throttles"
      condition = "C"

      data {
        ref_id         = "A"
        query_type     = ""
        datasource_uid = grafana_data_source.cloudwatch_source.uid

        model = jsonencode({
          refId      = "A"
          region     = var.aws_region
          namespace  = "AWS/Lambda"
          metricName = "Throttles"
          statistic  = "Sum"
          period     = "300"
          dimensions = {
            FunctionName = rule.value
          }
        })

        relative_time_range {
          from = 300
          to   = 0
        }
      }

      data {
        ref_id         = "B"
        query_type     = ""
        datasource_uid = "__expr__"

        model = <<EOT
{"conditions":[{"evaluator":{"params":[0,0],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"params":[],"type":"sum"},"type":"query"}],"datasource":{"name":"Expression","type":"__expr__","uid":"__expr__"},"expression":"A","hide":false,"intervalMs":1000,"maxDataPoints":43200,"reducer":"sum","refId":"B","type":"reduce"}
EOT

        relative_time_range {
          from = 0
          to   = 0
        }
      }

      data {
        ref_id         = "C"
        query_type     = ""
        datasource_uid = "__expr__"

        model = jsonencode({
          expression = "$B > 0"
          type       = "math"
          refId      = "C"
        })

        relative_time_range {
          from = 0
          to   = 0
        }
      }

      no_data_state  = "OK"
      exec_err_state = "OK"
      for            = "5m"

      annotations = {
        description      = "Macro sandbox ${rule.key} Lambda is being throttled"
        summary          = "Macro sandbox ${rule.key} throttling detected"
        runbook_url      = "${var.runbook_base_url}/docs/runbooks/sandbox-throttles.md"
        __dashboardUid__ = local.heartbeat_daily_uid
        __panelId__      = local.heartbeat_panel_ids["sandbox-throttles"]
      }
      labels = {
        metric_id = "sandbox-throttles"
        severity  = "warning"
        service   = "macro-sandbox"
      }
    }
  }

  rule {
    name      = "Macro Sandbox Rejected Traffic"
    condition = "C"

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      model = jsonencode({
        refId      = "A"
        region     = var.aws_region
        namespace  = "OpenJII/MacroSandbox"
        metricName = "MacroSandboxRejectedTraffic-${var.environment}"
        statistic  = "Sum"
        period     = "300"
      })

      relative_time_range {
        from = 300
        to   = 0
      }
    }

    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "__expr__"

      model = <<EOT
{"conditions":[{"evaluator":{"params":[0,0],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"params":[],"type":"sum"},"type":"query"}],"datasource":{"name":"Expression","type":"__expr__","uid":"__expr__"},"expression":"A","hide":false,"intervalMs":1000,"maxDataPoints":43200,"reducer":"sum","refId":"B","type":"reduce"}
EOT

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    data {
      ref_id         = "C"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "$B > 100"
        type       = "math"
        refId      = "C"
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    no_data_state  = "OK"
    exec_err_state = "OK"
    for            = "5m"

    annotations = {
      description      = "High rejected traffic from macro-sandbox isolated subnets — potential escape attempt"
      summary          = "Macro sandbox rejected VPC traffic anomaly"
      runbook_url      = "${var.runbook_base_url}/docs/runbooks/sandbox-blocked-connections.md"
      __dashboardUid__ = local.heartbeat_daily_uid
      __panelId__      = local.heartbeat_panel_ids["sandbox-blocked-connections"]
    }
    labels = {
      metric_id = "sandbox-blocked-connections"
      severity  = "warning"
      service   = "macro-sandbox"
      category  = "security"
    }
  }
}

# Calibration Sandbox Alerts
# A bench session produces a handful of invocations a day, so the macro sandbox's
# "more than 10 errors in 5 minutes" would never fire here. The thresholds below are
# set for that volume: one failure or one throttle is the feature being down.
resource "grafana_rule_group" "calibration_sandbox_health" {
  count = var.calibration_sandbox_function_name != "" ? 1 : 0

  provider           = grafana.amg
  name               = "Calibration Sandbox Health"
  folder_uid         = grafana_folder.folder.uid
  interval_seconds   = 60
  disable_provenance = true

  rule {
    name      = "Calibration Sandbox Errors"
    condition = "C"

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      model = jsonencode({
        refId      = "A"
        region     = var.aws_region
        namespace  = "AWS/Lambda"
        metricName = "Errors"
        statistic  = "Sum"
        period     = "300"
        dimensions = {
          FunctionName = var.calibration_sandbox_function_name
        }
      })

      relative_time_range {
        from = 300
        to   = 0
      }
    }

    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "__expr__"

      model = <<EOT
{"conditions":[{"evaluator":{"params":[0,0],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"params":[],"type":"sum"},"type":"query"}],"datasource":{"name":"Expression","type":"__expr__","uid":"__expr__"},"expression":"A","hide":false,"intervalMs":1000,"maxDataPoints":43200,"reducer":"sum","refId":"B","type":"reduce"}
EOT

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    data {
      ref_id         = "C"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "$B > 0"
        type       = "math"
        refId      = "C"
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    # The handler answers every script fault itself, so a function error is the runtime
    # failing, and one is worth a page. The hold is one evaluation: with a 5-minute window
    # summed each minute, a 5-minute hold let a single error age out before it fired.
    no_data_state  = "OK"
    exec_err_state = "OK"
    for            = "1m"

    annotations = {
      description      = "Calibration sandbox Lambda has failed in the last 5 minutes"
      summary          = "Calibration sandbox errors"
      runbook_url      = "${var.runbook_base_url}/docs/runbooks/sandbox-errors.md"
      __dashboardUid__ = local.heartbeat_daily_uid
      __panelId__      = local.heartbeat_panel_ids["sandbox-errors"]
    }
    labels = {
      metric_id = "sandbox-errors"
      severity  = "warning"
      service   = "calibration-sandbox"
    }
  }

  rule {
    name      = "Calibration Sandbox Throttles"
    condition = "C"

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      model = jsonencode({
        refId      = "A"
        region     = var.aws_region
        namespace  = "AWS/Lambda"
        metricName = "Throttles"
        statistic  = "Sum"
        period     = "300"
        dimensions = {
          FunctionName = var.calibration_sandbox_function_name
        }
      })

      relative_time_range {
        from = 300
        to   = 0
      }
    }

    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "__expr__"

      model = <<EOT
{"conditions":[{"evaluator":{"params":[0,0],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"params":[],"type":"sum"},"type":"query"}],"datasource":{"name":"Expression","type":"__expr__","uid":"__expr__"},"expression":"A","hide":false,"intervalMs":1000,"maxDataPoints":43200,"reducer":"sum","refId":"B","type":"reduce"}
EOT

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    data {
      ref_id         = "C"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "$B > 0"
        type       = "math"
        refId      = "C"
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    no_data_state  = "OK"
    exec_err_state = "OK"
    for            = "1m"

    annotations = {
      description      = "Calibration sandbox Lambda is being throttled, so a bench session cannot compute its coefficients"
      summary          = "Calibration sandbox throttling detected"
      runbook_url      = "${var.runbook_base_url}/docs/runbooks/sandbox-throttles.md"
      __dashboardUid__ = local.heartbeat_daily_uid
      __panelId__      = local.heartbeat_panel_ids["sandbox-throttles"]
    }
    labels = {
      metric_id = "sandbox-throttles"
      severity  = "warning"
      service   = "calibration-sandbox"
    }
  }

  rule {
    name      = "Calibration Sandbox Rejected Traffic"
    condition = "C"

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      model = jsonencode({
        refId      = "A"
        region     = var.aws_region
        namespace  = "OpenJII/CalibrationSandbox"
        metricName = "CalibrationSandboxRejectedTraffic-${var.environment}"
        statistic  = "Sum"
        period     = "300"
      })

      relative_time_range {
        from = 300
        to   = 0
      }
    }

    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "__expr__"

      model = <<EOT
{"conditions":[{"evaluator":{"params":[0,0],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"params":[],"type":"sum"},"type":"query"}],"datasource":{"name":"Expression","type":"__expr__","uid":"__expr__"},"expression":"A","hide":false,"intervalMs":1000,"maxDataPoints":43200,"reducer":"sum","refId":"B","type":"reduce"}
EOT

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    data {
      ref_id         = "C"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "$B > 100"
        type       = "math"
        refId      = "C"
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    no_data_state  = "OK"
    exec_err_state = "OK"
    for            = "5m"

    annotations = {
      description      = "High rejected traffic from calibration-sandbox isolated subnets, a possible escape attempt"
      summary          = "Calibration sandbox rejected VPC traffic anomaly"
      runbook_url      = "${var.runbook_base_url}/docs/runbooks/sandbox-blocked-connections.md"
      __dashboardUid__ = local.heartbeat_daily_uid
      __panelId__      = local.heartbeat_panel_ids["sandbox-blocked-connections"]
    }
    labels = {
      metric_id = "sandbox-blocked-connections"
      severity  = "warning"
      service   = "calibration-sandbox"
      category  = "security"
    }
  }
}

# Ingest Path Alerts
#
# The loop Critical Flows calls the one that must always work had no Grafana rule at all:
# every existing group watches ECS, ALB, CloudFront, Route53, Lambda or RDS. These three
# cover the catalog's ingest entries 2, 8 and 9.
#
# Thresholds here are deliberately not the catalog's. The catalog answers "was yesterday
# unusual" over 24h for the daily report; these answer "is it broken right now" over minutes.
# The drift test pairs the two on identity and severity, never on numbers.
resource "grafana_rule_group" "ingest_path" {
  provider         = grafana.amg
  name             = "Ingest Path"
  folder_uid       = grafana_folder.folder.uid
  interval_seconds = 300

  # Catalog entry 2. A message the broker accepted and then failed to deliver is the one
  # ingest failure that loses data rather than delaying it.
  #
  # The catalog alarms on any nonzero, which is right for a morning report. Compiled here
  # verbatim it would page on a single retryable failure, because a trailing sum stays
  # above zero for every evaluation the failure remains in window. So this fires on
  # sustained loss and the daily report's tile still counts every single failure.
  rule {
    name      = "Ingest Forwarding Failures"
    condition = "C"

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      # Published per rule and action, so matchExact false with no dimensions is what
      # covers every rule without naming them, and each series alerts on its own.
      model = jsonencode({
        refId      = "A"
        region     = var.aws_region
        namespace  = "AWS/IoT"
        metricName = "Failure"
        statistic  = "Sum"
        dimensions = {}
        matchExact = false
      })

      relative_time_range {
        from = 900
        to   = 0
      }
    }

    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "A"
        type       = "reduce"
        reducer    = "sum"
        refId      = "B"
        settings = {
          mode             = "replaceNN"
          replaceWithValue = 0
        }
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    data {
      ref_id         = "C"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "$B > 5"
        type       = "math"
        refId      = "C"
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    # No failures published is the healthy case for a counter, not an unknown one.
    no_data_state  = "OK"
    exec_err_state = "OK"
    for            = "5m"

    annotations = {
      description      = "IoT rule actions are failing to forward accepted messages; this loses data rather than delaying it."
      summary          = "Ingest forwarding failures on the IoT rule engine"
      runbook_url      = "${var.runbook_base_url}/docs/runbooks/ingest-forwarding-failures.md"
      __dashboardUid__ = local.heartbeat_daily_uid
      __panelId__      = local.heartbeat_panel_ids["ingest-forwarding-failures"]
    }
    labels = {
      severity  = "critical"
      service   = "ingest"
      metric_id = "ingest-forwarding-failures"
    }
  }

  # Catalog entry 8. Nothing is lost while the age stays under the stream's 24h
  # retention, but everything downstream is behind by the age shown.
  rule {
    name      = "Ingest Lag"
    condition = "C"

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      model = jsonencode({
        refId      = "A"
        region     = var.aws_region
        namespace  = "AWS/Kinesis"
        metricName = "GetRecords.IteratorAgeMilliseconds"
        statistic  = "Maximum"
        dimensions = {
          StreamName = var.kinesis_stream_name
        }
      })

      # An hour, because the series only exists while a consumer is polling. A five
      # minute window would evaluate NoData most of the time and never hold a state
      # long enough for `for` to elapse.
      relative_time_range {
        from = 3600
        to   = 0
      }
    }

    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "A"
        type       = "reduce"
        reducer    = "last"
        refId      = "B"
        settings = {
          mode = "dropNN"
        }
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    data {
      ref_id         = "C"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "$B > ${var.ingest_lag_threshold_ms}"
        type       = "math"
        refId      = "C"
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    # A consumer that dies completely stops publishing this metric, so absence is the
    # one case this rule cannot see. Ingest Stalled, which reads bronze beside the
    # stream's incoming records, is what notices that consumer.
    no_data_state  = "OK"
    exec_err_state = "OK"
    for            = "15m"

    annotations = {
      description      = "Kinesis iterator age is above the environment's tolerance: the consumer is not keeping up or is not running."
      summary          = "Ingest lag climbing on the data ingest stream"
      runbook_url      = "${var.runbook_base_url}/docs/runbooks/ingest-lag.md"
      __dashboardUid__ = local.heartbeat_daily_uid
      __panelId__      = local.heartbeat_panel_ids["ingest-lag"]
    }
    labels = {
      severity  = "warning"
      service   = "ingest"
      metric_id = "ingest-lag"
    }
  }

  # Catalog entry 9. A throttled write is a dropped record once the rule stops retrying.
  rule {
    name      = "Kinesis Write Throttling"
    condition = "C"

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      model = jsonencode({
        refId      = "A"
        region     = var.aws_region
        namespace  = "AWS/Kinesis"
        metricName = "WriteProvisionedThroughputExceeded"
        statistic  = "Sum"
        dimensions = {
          StreamName = var.kinesis_stream_name
        }
      })

      relative_time_range {
        from = 900
        to   = 0
      }
    }

    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "A"
        type       = "reduce"
        reducer    = "sum"
        refId      = "B"
        settings = {
          mode             = "replaceNN"
          replaceWithValue = 0
        }
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    data {
      ref_id         = "C"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "$B > 0"
        type       = "math"
        refId      = "C"
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    no_data_state  = "OK"
    exec_err_state = "OK"
    for            = "10m"

    annotations = {
      description      = "Writes into the ingest stream are being rejected for exceeding provisioned throughput; what the rule cannot place is dropped."
      summary          = "Kinesis write throttling on the data ingest stream"
      runbook_url      = "${var.runbook_base_url}/docs/runbooks/kinesis-write-throttling.md"
      __dashboardUid__ = local.heartbeat_daily_uid
      __panelId__      = local.heartbeat_panel_ids["kinesis-write-throttling"]
    }
    labels = {
      severity  = "warning"
      service   = "ingest"
      metric_id = "kinesis-write-throttling"
    }
  }

  # Catalog entry 89. Records waiting on the stream while bronze has written nothing for an
  # hour: the consumer died or runs without writing. Kinesis keeps records for 24 hours, so
  # this is data held up rather than lost. It also covers a consumer that died entirely,
  # which Ingest Lag reads as no data.
  #
  # The export measures idle time every half hour, so a reading can be 35 minutes old. Only
  # records that arrived 45 to 60 minutes ago count: they came after bronze's last write (the
  # reading says over 60 minutes ago) and at least five minutes before the reading, so bronze
  # had time to take them. Newer records would fire it on a stale reading after a quiet spell.
  rule {
    name      = "Ingest Stalled"
    condition = "E"

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      model = jsonencode({
        refId      = "A"
        region     = var.aws_region
        namespace  = "OpenJII/Data"
        metricName = "IngestIdleMinutes"
        statistic  = "Maximum"
        dimensions = {
          Environment = var.environment
        }
      })

      relative_time_range {
        from = 2400
        to   = 0
      }
    }
    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "A"
        type       = "reduce"
        reducer    = "last"
        refId      = "B"
        settings = {
          mode = "dropNN"
        }
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }
    data {
      ref_id         = "C"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      model = jsonencode({
        refId      = "C"
        region     = var.aws_region
        namespace  = "AWS/Kinesis"
        metricName = "IncomingRecords"
        statistic  = "Sum"
        dimensions = {
          StreamName = var.kinesis_stream_name
        }
      })

      relative_time_range {
        from = 3600
        to   = 2700
      }
    }
    data {
      ref_id         = "D"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "C"
        type       = "reduce"
        reducer    = "sum"
        refId      = "D"
        settings = {
          mode             = "replaceNN"
          replaceWithValue = 0
        }
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }
    data {
      ref_id         = "E"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "$B > 60 && $D > 0"
        type       = "math"
        refId      = "E"
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }
    no_data_state  = "OK"
    exec_err_state = "OK"
    for            = "10m"

    annotations = {
      description      = "Records have been waiting on the ingest stream while bronze has written nothing for over an hour; measurements are held up in Kinesis, which keeps them 24 hours."
      summary          = "Ingest stalled: records waiting, bronze not writing"
      runbook_url      = "${var.runbook_base_url}/docs/runbooks/ingest-idle.md"
      __dashboardUid__ = local.heartbeat_daily_uid
      __panelId__      = local.heartbeat_panel_ids["ingest-idle"]
    }
    labels = {
      severity  = "warning"
      service   = "ingest"
      metric_id = "ingest-idle"
    }
  }

  # Catalog entry 91. IoT Core refusing publishes outright: a device not allowed on its topic,
  # or a message over a broker limit such as 128 KiB. The sender is never told. Prod refuses a
  # few every hour, so this fires on a burst (100 in five minutes), like the auth storm of
  # 16 to 19 September, and the daily trickle stays a level on the report.
  rule {
    name      = "Refused Publish Burst"
    condition = "C"

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      model = jsonencode({
        refId            = "A"
        region           = var.aws_region
        namespace        = "AWS/IoT"
        queryMode        = "Metrics"
        metricQueryType  = 0
        metricEditorMode = 1
        statistic        = "Sum"
        period           = "300"
        id               = "refused"
        expression       = "SUM(SEARCH('{AWS/IoT,Protocol} MetricName=\"PublishIn.AuthError\" OR MetricName=\"PublishIn.ClientError\" OR MetricName=\"PublishIn.ServerError\" OR MetricName=\"PublishIn.Throttle\"', 'Sum', 300))"
      })

      relative_time_range {
        from = 600
        to   = 0
      }
    }
    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "A"
        type       = "reduce"
        reducer    = "max"
        refId      = "B"
        settings = {
          mode             = "replaceNN"
          replaceWithValue = 0
        }
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }
    data {
      ref_id         = "C"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "$B > 100"
        type       = "math"
        refId      = "C"
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }
    no_data_state  = "OK"
    exec_err_state = "OK"
    for            = "10m"

    annotations = {
      description      = "IoT Core has refused more than 100 publishes in five minutes; those messages never reached the platform and their senders were not told why."
      summary          = "Burst of publishes refused by IoT Core"
      runbook_url      = "${var.runbook_base_url}/docs/runbooks/rejected-publishes.md"
      __dashboardUid__ = local.heartbeat_daily_uid
      __panelId__      = local.heartbeat_panel_ids["rejected-publishes"]
    }
    labels = {
      severity  = "warning"
      service   = "ingest"
      metric_id = "rejected-publishes"
    }
  }
}

# Monitoring Self Health
#
# The forwarder is what carries lakehouse signals into CloudWatch. If it throws, every
# lakehouse panel and rule goes quiet at once, and nothing else would say so.
resource "grafana_rule_group" "monitoring_self_health" {
  count = var.metrics_forwarder_function_name != "" ? 1 : 0

  provider         = grafana.amg
  name             = "Monitoring Self Health"
  folder_uid       = grafana_folder.folder.uid
  interval_seconds = 300

  rule {
    name      = "Metrics Forwarder Errors"
    condition = "C"

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      model = jsonencode({
        refId      = "A"
        region     = var.aws_region
        namespace  = "AWS/Lambda"
        metricName = "Errors"
        statistic  = "Sum"
        dimensions = {
          FunctionName = var.metrics_forwarder_function_name
        }
      })

      relative_time_range {
        from = 3600
        to   = 0
      }
    }

    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "A"
        type       = "reduce"
        reducer    = "sum"
        refId      = "B"
        settings = {
          mode             = "replaceNN"
          replaceWithValue = 0
        }
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    data {
      ref_id         = "C"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "$B > 0"
        type       = "math"
        refId      = "C"
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    no_data_state  = "OK"
    exec_err_state = "OK"
    for            = "5m"

    annotations = {
      description      = "The metrics forwarder threw. Heartbeat files are still in S3, but every lakehouse tile on the daily report goes quiet until this clears."
      summary          = "Metrics forwarder is failing to publish"
      runbook_url      = "${var.runbook_base_url}/docs/runbooks/metrics-forwarder-errors.md"
      __dashboardUid__ = local.heartbeat_daily_uid
      __panelId__      = local.heartbeat_panel_ids["metrics-forwarder-errors"]
    }
    labels = {
      severity  = "warning"
      service   = "monitoring"
      metric_id = "metrics-forwarder-errors"
    }
  }
}

# The lakehouse export's dead-man. It watches a Databricks job rather than a Lambda, so
# it is not tied to a function name that could be empty.
resource "grafana_rule_group" "collector_liveness" {
  provider         = grafana.amg
  name             = "Collector Liveness"
  folder_uid       = grafana_folder.folder.uid
  interval_seconds = 300

  # Catalog entry 10. The lakehouse export publishes this on every scheduler cycle for
  # no reason other than so its absence can alarm. It is the only signal that tells you
  # the collector died rather than that the platform went quiet.
  rule {
    name      = "Heartbeat Collector Dead-Man"
    condition = "C"

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      model = jsonencode({
        refId      = "A"
        region     = var.aws_region
        namespace  = "OpenJII/Data"
        metricName = "CollectorHeartbeat"
        statistic  = "Maximum"
        dimensions = {
          Environment = var.environment
        }
      })

      relative_time_range {
        from = local.heartbeat_dead_man_window_minutes * 60
        to   = 0
      }
    }

    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "A"
        type       = "reduce"
        reducer    = "count"
        refId      = "B"
        settings = {
          mode             = "replaceNN"
          replaceWithValue = 0
        }
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    data {
      ref_id         = "C"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "$B < 1"
        type       = "math"
        refId      = "C"
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    no_data_state  = "Alerting"
    exec_err_state = "Alerting"
    for            = "15m"

    annotations = {
      description      = "The lakehouse heartbeat export has stopped publishing. Every lakehouse tile on the daily report is now absent rather than healthy."
      summary          = "Heartbeat collector stopped reporting"
      runbook_url      = "${var.runbook_base_url}/docs/runbooks/dlt-heartbeat.md"
      __dashboardUid__ = local.heartbeat_daily_uid
      __panelId__      = local.heartbeat_panel_ids["dlt-heartbeat"]
    }
    labels = {
      metric_id = "dlt-heartbeat"
      severity  = "warning"
      service   = "monitoring"
    }
  }

  # Catalog entry 96. A collector that raised costs only its own series, which then read No
  # data. One failed run is usually transient, so this waits for two in a row.
  rule {
    name      = "Heartbeat Collector Failing"
    condition = "C"

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      model = jsonencode({
        refId      = "A"
        region     = var.aws_region
        namespace  = "OpenJII/Data"
        metricName = "CollectorFailures"
        statistic  = "Maximum"
        dimensions = {
          Environment = var.environment
        }
      })

      relative_time_range {
        from = 4500
        to   = 0
      }
    }
    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "A"
        type       = "reduce"
        reducer    = "last"
        refId      = "B"
        settings = {
          mode = "dropNN"
        }
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }
    data {
      ref_id         = "C"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "$B > 0"
        type       = "math"
        refId      = "C"
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }
    no_data_state  = "OK"
    exec_err_state = "OK"
    for            = "40m"

    annotations = {
      description      = "At least one heartbeat collector has failed on two runs in a row, so its series on the daily report read No data rather than healthy."
      summary          = "Heartbeat collectors failing"
      runbook_url      = "${var.runbook_base_url}/docs/runbooks/collector-failures.md"
      __dashboardUid__ = local.heartbeat_daily_uid
      __panelId__      = local.heartbeat_panel_ids["collector-failures"]
    }
    labels = {
      severity  = "warning"
      service   = "monitoring"
      metric_id = "collector-failures"
    }
  }
}

# Lakehouse Freshness
#
# The public metrics tables are rewritten on every scheduler cycle, so their age is how
# stale the numbers on the public page are. Value-based rather than absence-based, so it
# needs no gate: dlt-heartbeat is what notices the producer stopping altogether.
resource "grafana_rule_group" "lakehouse_freshness" {
  provider         = grafana.amg
  name             = "Lakehouse Freshness"
  folder_uid       = grafana_folder.folder.uid
  interval_seconds = 300

  # Catalog entry 41. The scheduler runs hourly and an update takes minutes, so past 90
  # minutes the last update did not land.
  rule {
    name      = "Metrics Tables Stale"
    condition = "C"

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      model = jsonencode({
        refId      = "A"
        region     = var.aws_region
        namespace  = "OpenJII/Data"
        metricName = "MetricsPipelineAgeMinutes"
        statistic  = "Maximum"
        dimensions = {
          Environment = var.environment
        }
      })

      relative_time_range {
        from = 3600
        to   = 0
      }
    }

    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "A"
        type       = "reduce"
        reducer    = "last"
        refId      = "B"
        settings = {
          mode = "dropNN"
        }
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    data {
      ref_id         = "C"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "$B > 90"
        type       = "math"
        refId      = "C"
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    no_data_state  = "OK"
    exec_err_state = "OK"
    for            = "15m"

    annotations = {
      description      = "The public metrics tables have not been recomputed for over 90 minutes, so every number on the public page is at least that stale."
      summary          = "Metrics tables are stale"
      runbook_url      = "${var.runbook_base_url}/docs/runbooks/metrics-mv-freshness.md"
      __dashboardUid__ = local.heartbeat_daily_uid
      __panelId__      = local.heartbeat_panel_ids["metrics-mv-freshness"]
    }
    labels = {
      metric_id = "metrics-mv-freshness"
      severity  = "warning"
      service   = "lakehouse"
    }
  }

  # Catalog entry 88. Rows that need macros and have had no result for 15 minutes. A failed
  # macro still writes a result row, so anything above zero for an hour is results not being
  # produced: the macro pipeline stopped, or the sandboxes are not answering.
  rule {
    name      = "Macro Backlog"
    condition = "C"

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      model = jsonencode({
        refId      = "A"
        region     = var.aws_region
        namespace  = "OpenJII/Data"
        metricName = "MacroBacklogRows"
        statistic  = "Maximum"
        dimensions = {
          Environment = var.environment
        }
      })

      relative_time_range {
        from = 4500
        to   = 0
      }
    }
    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "A"
        type       = "reduce"
        reducer    = "last"
        refId      = "B"
        settings = {
          mode = "dropNN"
        }
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }
    data {
      ref_id         = "C"
      query_type     = ""
      datasource_uid = "__expr__"

      model = jsonencode({
        expression = "$B > 0"
        type       = "math"
        refId      = "C"
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }
    no_data_state  = "OK"
    exec_err_state = "OK"
    for            = "60m"

    annotations = {
      description      = "Rows that need macros have waited over an hour without any result, so researchers see measurements without their computed values."
      summary          = "Macro results are not being produced"
      runbook_url      = "${var.runbook_base_url}/docs/runbooks/macro-backlog.md"
      __dashboardUid__ = local.heartbeat_daily_uid
      __panelId__      = local.heartbeat_panel_ids["macro-backlog"]
    }
    labels = {
      severity  = "warning"
      service   = "lakehouse"
      metric_id = "macro-backlog"
    }
  }
}

resource "grafana_notification_policy" "policy" {
  provider = grafana.amg

  group_by        = ["alertname", "service"]
  contact_point   = grafana_contact_point.slack.name
  group_wait      = "30s"
  group_interval  = "5m"
  repeat_interval = "12h"

  policy {
    matcher {
      label = "severity"
      match = "="
      value = "critical"
    }
    group_by        = ["alertname"]
    contact_point   = grafana_contact_point.slack.name
    repeat_interval = "30m"
  }

  policy {
    matcher {
      label = "category"
      match = "="
      value = "dora"
    }
    group_by        = ["alertname"]
    contact_point   = grafana_contact_point.slack.name
    repeat_interval = "1d"
  }
}
