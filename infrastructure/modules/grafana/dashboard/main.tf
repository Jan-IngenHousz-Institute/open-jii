terraform {
  required_providers {
    grafana = {
      source                = "grafana/grafana"
      version               = ">= 4.2.1"
      configuration_aliases = [grafana.amg]
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  dashboard_json_file = file("${path.module}/dashboard.json.tftpl")

  dashboard_vars = {
    datasource_uid             = grafana_data_source.cloudwatch_source.uid
    logs_datasource_uid        = grafana_data_source.cloudwatch_logs_source.uid
    project                    = var.project
    environment                = var.environment
    aws_region                 = var.aws_region
    cloudfront_distribution_id = var.cloudfront_distribution_id
    load_balancer_dimension    = join("/", slice(split("/", var.load_balancer_arn), 1, length(split("/", var.load_balancer_arn))))
    target_group_dimension     = element(split(":", var.target_group_arn), length(split(":", var.target_group_arn)) - 1)
    ecs_cluster_name           = var.ecs_cluster_name
    ecs_service_name           = var.ecs_service_name
    server_function_name       = var.server_function_name
    db_cluster_identifier      = var.db_cluster_identifier
    kinesis_stream_name        = var.kinesis_stream_name
    ecs_log_group_name         = var.ecs_log_group_name
    iot_log_group_name         = var.iot_log_group_name
    account_id                 = data.aws_caller_identity.current.account_id
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
  provider         = grafana.amg
  name             = "Backend API Alerts"
  folder_uid       = grafana_folder.folder.uid
  interval_seconds = 60
  # disable_provenance = true

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

  #   rule {
  #     name      = "Backend High 5xx Error Rate"
  #     condition = "C"

  #     data {
  #       ref_id         = "A"
  #       query_type     = ""
  #       datasource_uid = grafana_data_source.cloudwatch_source.uid

  #       model = jsonencode({
  #         refId            = "A"
  #         region           = var.aws_region
  #         namespace        = "AWS/ApplicationELB"
  #         metricName       = "HTTPCode_Target_5XX_Count"
  #         statistic        = "Sum"
  #         period           = "300"
  #         matchExact       = true
  #         metricEditorMode = 0
  #         metricQueryType  = 0
  #         queryMode        = "Metrics"
  #         id               = "m1"
  #         expression       = "FILL(m1, 0)"
  #         dimensions = {
  #           LoadBalancer = [local.dashboard_vars.load_balancer_dimension]
  #         }
  #       })

  #       relative_time_range {
  #         from = 300
  #         to   = 0
  #       }
  #     }

  #     data {
  #       ref_id         = "B"
  #       query_type     = ""
  #       datasource_uid = "__expr__"

  #       model = <<EOT
  # {"conditions":[{"evaluator":{"params":[0,0],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"params":[],"type":"sum"},"type":"query"}],"datasource":{"name":"Expression","type":"__expr__","uid":"__expr__"},"expression":"A","hide":false,"intervalMs":1000,"maxDataPoints":43200,"reducer":"sum","refId":"B","type":"reduce"}
  # EOT

  #       relative_time_range {
  #         from = 0
  #         to   = 0
  #       }
  #     }

  #     data {
  #       ref_id         = "C"
  #       query_type     = ""
  #       datasource_uid = "__expr__"

  #       model = jsonencode({
  #         expression = "$B > 5"
  #         type       = "math"
  #         refId      = "C"
  #       })

  #       relative_time_range {
  #         from = 0
  #         to   = 0
  #       }
  #     }

  #     no_data_state  = "OK"
  #     exec_err_state = "OK"
  #     for            = "5m"

  #     annotations = {
  #       description = "Backend is returning 5xx errors"
  #       summary     = "5xx errors detected on backend service"
  #     }
  #     labels = {
  #       severity = "critical"
  #       service  = "backend"
  #     }
  #   }
}

# CloudFront Alerts
resource "grafana_rule_group" "cloudfront_errors" {
  provider         = grafana.amg
  name             = "CloudFront Errors"
  folder_uid       = grafana_folder.folder.uid
  interval_seconds = 60

  rule {
    name      = "High CloudFront Error Rate"
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
      datasource_uid = grafana_data_source.cloudwatch_source.uid

      model = jsonencode({
        refId      = "B"
        region     = "us-east-1"
        namespace  = "AWS/CloudFront"
        metricName = "4xxErrorRate"
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
      ref_id         = "C"
      query_type     = ""
      datasource_uid = "-100"

      model = jsonencode({
        conditions = [
          {
            evaluator = {
              params = [5]
              type   = "gt"
            }
            operator = {
              type = "or"
            }
            query = {
              params = ["C"]
            }
            type = "query"
          }
        ]
        expression = "$A + $B"
        type       = "math"
      })

      relative_time_range {
        from = 300
        to   = 0
      }
    }

    no_data_state  = "NoData"
    exec_err_state = "OK"
    for            = "5m"

    annotations = {
      description = "CloudFront error rate is above 5%"
      summary     = "High error rate on CloudFront distribution"
    }
    labels = {
      severity = "warning"
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
      description = "Lambda function has more than 5 errors in the last 5 minutes"
      summary     = "High error rate on Lambda function"
    }
    labels = {
      severity = "warning"
      service  = "lambda"
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
    for            = "5m"

    annotations = {
      description = "Lambda function is being throttled"
      summary     = "Lambda throttling detected"
    }
    labels = {
      severity = "critical"
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

# Notification policy
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
