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
  dashboard_json_file = file("${path.module}/dashboard.json.tftpl")

  dashboard_vars = {
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
    ecs_log_group_name                 = var.ecs_log_group_name
    iot_log_group_name                 = var.iot_log_group_name
    account_id                         = data.aws_caller_identity.current.account_id
    macro_sandbox_python_function_name = lookup(var.macro_sandbox_function_names, "python", "")
    macro_sandbox_js_function_name     = lookup(var.macro_sandbox_function_names, "js", "")
    macro_sandbox_r_function_name      = lookup(var.macro_sandbox_function_names, "r", "")
    calibration_sandbox_function_name  = var.calibration_sandbox_function_name
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

resource "grafana_folder" "folder" {
  provider = grafana.amg
  title    = "${var.environment} Dashboards"
  uid      = "${var.environment}-dashboards"
}

resource "grafana_dashboard" "dashboard" {
  provider  = grafana.amg
  folder    = grafana_folder.folder.id
  overwrite = true

  config_json = templatefile("${path.module}/dashboard.json.tftpl", local.dashboard_vars)
}

resource "grafana_dashboard" "registrations_dashboard" {
  provider  = grafana.amg
  folder    = grafana_folder.folder.id
  overwrite = true

  config_json = templatefile("${path.module}/registrations_dashboard.json.tftpl", {
    datasource_uid = grafana_data_source.cloudwatch_source.uid
    environment    = var.environment
    aws_region     = var.aws_region
    project        = var.project
  })
}


resource "grafana_dashboard" "dora_dashboard" {
  provider  = grafana.amg
  folder    = grafana_folder.folder.id
  overwrite = true

  config_json = templatefile("${path.module}/dora.json.tftpl",
    {
      datasource_uid = grafana_data_source.cloudwatch_source.uid
      project        = var.project
      environment    = var.environment
      aws_region     = var.aws_region
      account_id     = data.aws_caller_identity.current.account_id
    }
  )
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
      description = "Backend ECS service CPU usage is above 80%"
      summary     = "High CPU usage on backend service"
    }
    labels = {
      severity = "warning"
      service  = "backend"
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
      description = "Unhealthy targets detected in backend service"
      summary     = "Backend service has unhealthy targets"
    }
    labels = {
      severity = "critical"
      service  = "backend"
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
        id               = "m1"
        expression       = "FILL(m1, 0)"
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
      description = "Backend is returning 5xx errors"
      summary     = "5xx errors detected on backend service"
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
      description = "CloudFront 5xx error rate is above 5% — origin may be down"
      summary     = "Site may be down: high 5xx rate on CloudFront"
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
      description = "Route53 health check reports the site is unreachable"
      summary     = "Site is down: active health check failing"
    }
    labels = {
      severity = "critical"
      service  = "frontend"
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
        expression = "FILL(m1, 0)"
        id         = "m1"
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
      description = "Server Lambda has more than 5 errors in the last 5 minutes — site may be down"
      summary     = "Site may be down: Server Lambda errors detected"
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
        expression = "FILL(m1, 0)"
        id         = "m1"
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
      description = "Lambda function is being throttled"
      summary     = "Lambda throttling detected"
    }
    labels = {
      severity = "warning"
      service  = "lambda"
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
      description = "Database CPU usage is above 80% "
      summary     = "High CPU usage on database cluster"
    }
    labels = {
      severity = "warning"
      service  = "database"
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
      description = "Database has high number of active connections (threshold: 80)"
      summary     = "High number of database connections"
    }
    labels = {
      severity = "warning"
      service  = "database"
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
          expression = "FILL(m1, 0)"
          id         = "m1"
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
        description = "Macro sandbox ${rule.key} Lambda has more than 10 errors in the last 5 minutes"
        summary     = "Macro sandbox ${rule.key} error rate high"
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
          expression = "FILL(m1, 0)"
          id         = "m1"
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
        description = "Macro sandbox ${rule.key} Lambda is being throttled"
        summary     = "Macro sandbox ${rule.key} throttling detected"
      }
      labels = {
        severity = "warning"
        service  = "macro-sandbox"
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
        expression = "FILL(m1, 0)"
        id         = "m1"
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
      description = "High rejected traffic from macro-sandbox isolated subnets — potential escape attempt"
      summary     = "Macro sandbox rejected VPC traffic anomaly"
    }
    labels = {
      severity = "warning"
      service  = "macro-sandbox"
      category = "security"
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
        expression = "FILL(m1, 0)"
        id         = "m1"
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
      description = "Calibration sandbox Lambda has failed in the last 5 minutes"
      summary     = "Calibration sandbox errors"
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
        expression = "FILL(m1, 0)"
        id         = "m1"
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
      description = "Calibration sandbox Lambda is being throttled, so a bench session cannot compute its coefficients"
      summary     = "Calibration sandbox throttling detected"
    }
    labels = {
      severity = "warning"
      service  = "calibration-sandbox"
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
        expression = "FILL(m1, 0)"
        id         = "m1"
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
      description = "High rejected traffic from calibration-sandbox isolated subnets, a possible escape attempt"
      summary     = "Calibration sandbox rejected VPC traffic anomaly"
    }
    labels = {
      severity = "warning"
      service  = "calibration-sandbox"
      category = "security"
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
# unusual" over 24h for the digest; these answer "is it broken right now" over minutes.
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
  # sustained loss and the digest still names every single failure the next morning.
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
      description = "IoT rule actions are failing to forward accepted messages; this loses data rather than delaying it. Runbook: docs/runbooks/ingest-forwarding-failures.md"
      summary     = "Ingest forwarding failures on the IoT rule engine"
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
    # one case this rule cannot see. OK rather than Alerting because the alternative
    # fires through every idle night on a scheduled pipeline. The gap is recorded in
    # the runbook; the ingest-collapse signal is what closes it.
    no_data_state  = "OK"
    exec_err_state = "OK"
    for            = "15m"

    annotations = {
      description = "Kinesis iterator age is above the environment's tolerance: the consumer is not keeping up or is not running. Runbook: docs/runbooks/ingest-lag.md"
      summary     = "Ingest lag climbing on the data ingest stream"
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
      description = "Writes into the ingest stream are being rejected for exceeding provisioned throughput; what the rule cannot place is dropped. Runbook: docs/runbooks/kinesis-write-throttling.md"
      summary     = "Kinesis write throttling on the data ingest stream"
    }
    labels = {
      severity  = "warning"
      service   = "ingest"
      metric_id = "kinesis-write-throttling"
    }
  }
}

# Monitoring Self Health
#
# Nothing watched the watchers: a composer that throws every morning produces no digest
# and no complaint, because the digest is the only thing that would have complained.
#
# Split into two groups on purpose. These rules watch for a signal that is present and
# wrong, so they are safe from the moment they apply. The liveness group below watches
# for a signal that is absent, which fires until its producer has run once.
resource "grafana_rule_group" "monitoring_self_health" {
  count = var.digest_composer_function_name != "" && var.metrics_forwarder_function_name != "" ? 1 : 0

  provider         = grafana.amg
  name             = "Monitoring Self Health"
  folder_uid       = grafana_folder.folder.uid
  interval_seconds = 300

  # Catalog entry 65, the "ran and threw" half. Liveness below is the "never ran" half,
  # and the same runbook opens by telling them apart.
  rule {
    name      = "Digest Composer Errors"
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
          FunctionName = var.digest_composer_function_name
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

    # The composer runs three times a day, so no Errors datapoint is the normal state
    # for most of the hour rather than a fault.
    no_data_state  = "OK"
    exec_err_state = "OK"
    for            = "1m"

    annotations = {
      description = "The digest composer threw. No digest was delivered for that run. Runbook: docs/runbooks/digest-composer-liveness.md"
      summary     = "Digest composer is failing"
    }
    labels = {
      severity  = "warning"
      service   = "monitoring"
      metric_id = "digest-composer-liveness"
    }
  }

  # Catalog entry 66. Errors only, never liveness: the forwarder is S3 event driven, so
  # a quiet day has no invocations at all and a liveness rule would fire through it.
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
      description = "The metrics forwarder threw. Heartbeat files are still in S3, but every lakehouse signal in the digest goes quiet until this clears. Runbook: docs/runbooks/metrics-forwarder-errors.md"
      summary     = "Metrics forwarder is failing to publish"
    }
    labels = {
      severity  = "warning"
      service   = "monitoring"
      metric_id = "metrics-forwarder-errors"
    }
  }
}

# Absence-based rules.
#
# A Lambda that has never run publishes no Invocations at all, so on a fresh environment
# this fires until the first scheduled digest. That reading is correct rather than false:
# the composer genuinely is not running yet, and it clears itself at 06:30. Holding it
# behind a flag instead would mean the dead-man is off by default, which is the one
# outcome this rule exists to prevent.
resource "grafana_rule_group" "monitoring_liveness" {
  count = var.digest_composer_function_name != "" ? 1 : 0

  provider         = grafana.amg
  name             = "Monitoring Liveness"
  folder_uid       = grafana_folder.folder.uid
  interval_seconds = 300

  # Catalog entry 65, the "never ran" half.
  rule {
    name      = "Digest Composer Stopped Running"
    condition = "C"

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      model = jsonencode({
        refId      = "A"
        region     = var.aws_region
        namespace  = "AWS/Lambda"
        metricName = "Invocations"
        statistic  = "Sum"
        dimensions = {
          FunctionName = var.digest_composer_function_name
        }
      })

      # 26 hours: the daily digests are the shortest cadence, so a window just over a
      # day always spans at least two expected runs and a single missed one is not
      # enough to fire.
      relative_time_range {
        from = 93600
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
        expression = "$B < 1"
        type       = "math"
        refId      = "C"
      })

      relative_time_range {
        from = 0
        to   = 0
      }
    }

    # Absence is the entire signal here, so NoData has to mean firing. exec_err is
    # evaluated per evaluation rather than over the window, which is why `for` is long
    # enough that a single CloudWatch blip cannot page.
    no_data_state  = "Alerting"
    exec_err_state = "Alerting"
    for            = "30m"

    annotations = {
      description = "The digest composer has not run for over a day. While this is true, nothing is watching the platform on a schedule. Runbook: docs/runbooks/digest-composer-liveness.md"
      summary     = "Digest composer stopped running"
    }
    labels = {
      severity  = "warning"
      service   = "monitoring"
      metric_id = "digest-composer-liveness"
    }

  }
}

# The lakehouse export's dead-man. Separate from the group above because it watches a
# Databricks job rather than a Lambda, so tying it to a function name would drop it
# silently the moment that name were empty.
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

      # Seventy-five minutes covers two export cycles plus margin, so a single
      # missed run is not enough to fire.
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
      description = "The lakehouse heartbeat export has stopped publishing. Every dbx signal in the digest is now absent rather than healthy. Runbook: docs/runbooks/dlt-heartbeat.md"
      summary     = "Heartbeat collector stopped reporting"
    }
    labels = {
      metric_id = "dlt-heartbeat"
      severity  = "warning"
      service   = "monitoring"
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

  # Catalog entry 41. Measured at 12 minutes against a 60 minute threshold, so the
  # headroom is four scheduler cycles.
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
        expression = "$B > 60"
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
      description = "The public metrics tables have not been recomputed for over an hour, so every number on the public page is at least that stale. Runbook: docs/runbooks/metrics-mv-freshness.md"
      summary     = "Metrics tables are stale"
    }
    labels = {
      metric_id = "metrics-mv-freshness"
      severity  = "warning"
      service   = "lakehouse"
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
