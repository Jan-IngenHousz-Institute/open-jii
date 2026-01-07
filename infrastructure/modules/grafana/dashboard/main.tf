terraform {
  required_providers {
    grafana = {
      source                = "grafana/grafana"
      version               = ">= 4.2.1"
      configuration_aliases = [grafana.amg]
    }
  }
}

locals {
  dashboard_json_file = file("${path.module}/dashboard.json.tftpl")

  dashboard_vars = {
    datasource_uid             = grafana_data_source.cloudwatch_source.uid
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

### Alerting rules 

resource "grafana_contact_point" "slack" {
  provider = grafana.amg
  name     = "slack"

  slack {
    url = var.slack_webhook_url
  }

  lifecycle {
    ignore_changes = [slack] # if you store the webhook securely outside TF
  }
}

resource "grafana_folder" "alerts" {
  provider = grafana.amg
  title    = "${var.environment} Alerting"
}

# Rule group with one example rule: ALB Target 5xx > 5 in last 5m
resource "grafana_rule_group" "alb_5xx" {
  provider         = grafana.amg
  folder_uid       = grafana_folder.alerts.uid
  name             = "ALB errors"
  interval_seconds = 60

  rule {
    name           = "High ALB Target 5xx (sum > 5 in 5m)"
    condition      = "B"
    no_data_state  = "NoData"
    exec_err_state = "Alerting"
    for            = "2m"

    annotations = {
      summary = "High number of 5xx errors from ALB"
    }
    labels = {
      severity = "high"
      service  = "backend"
    }

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid
      relative_time_range {
        from = 300 # 5 minutes
        to   = 0
      }
      model = jsonencode({
        namespace  = "AWS/ApplicationELB"
        metricName = "HTTPCode_Target_5XX_Count"
        region     = var.aws_region
        statistic  = "Sum"
        dimensions = {
          LoadBalancer = join("/", slice(split("/", var.load_balancer_arn), 1, length(split("/", var.load_balancer_arn))))
          TargetGroup  = join("/", slice(split("/", var.target_group_arn), 1, length(split("/", var.target_group_arn))))
        }
        period        = "60"
        refId         = "A"
        hide          = false
        intervalMs    = 1000
        maxDataPoints = 43200
      })
    }

    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "-100"
      relative_time_range {
        from = 0
        to   = 0
      }
      model = jsonencode({
        conditions = [{
          evaluator = {
            params = [5]
            type   = "gt"
          }
          operator = {
            type = "and"
          }
          query = {
            params = ["A"]
          }
          reducer = {
            params = []
            type   = "last"
          }
          type = "query"
        }]
        datasource = {
          name = "Expression"
          type = "__expr__"
          uid  = "-100"
        }
        hide          = false
        intervalMs    = 1000
        maxDataPoints = 43200
        refId         = "B"
        type          = "classic_conditions"
      })
    }

    notification_settings {
      contact_point = grafana_contact_point.slack.name
    }
  }
}

resource "grafana_rule_group" "cloudfront_site_down" {
  provider         = grafana.amg
  folder_uid       = grafana_folder.alerts.uid
  name             = "CloudFront Site Down"
  interval_seconds = 60

  rule {
    name           = "High CloudFront Error Rate"
    condition      = "B"
    no_data_state  = "Alerting"
    exec_err_state = "Alerting"
    for            = "2m"

    annotations = {
      summary = "CloudFront error rate is above 5%"
    }
    labels = {
      severity = "critical"
      service  = "frontend"
    }

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid
      relative_time_range {
        from = 300 # 5 minutes
        to   = 0
      }
      model = jsonencode({
        namespace  = "AWS/CloudFront"
        metricName = "TotalErrorRate"
        region     = "Global"
        statistic  = "Average"
        dimensions = {
          DistributionId = var.cloudfront_distribution_id
        }
        period        = "60"
        refId         = "A"
        hide          = false
        intervalMs    = 1000
        maxDataPoints = 43200
      })
    }

    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "-100"
      relative_time_range {
        from = 0
        to   = 0
      }
      model = jsonencode({
        conditions = [{
          evaluator = {
            params = [0.05]
            type   = "gt"
          }
          operator = {
            type = "and"
          }
          query = {
            params = ["A"]
          }
          reducer = {
            params = []
            type   = "last"
          }
          type = "query"
        }]
        datasource = {
          name = "Expression"
          type = "__expr__"
          uid  = "-100"
        }
        hide          = false
        intervalMs    = 1000
        maxDataPoints = 43200
        refId         = "B"
        type          = "classic_conditions"
      })
    }

    notification_settings {
      contact_point = grafana_contact_point.slack.name
    }
  }
}

resource "grafana_rule_group" "lambda_errors" {
  provider         = grafana.amg
  folder_uid       = grafana_folder.alerts.uid
  name             = "Lambda Errors"
  interval_seconds = 60

  rule {
    name           = "High Lambda Error Count"
    condition      = "B"
    no_data_state  = "Alerting"
    exec_err_state = "Alerting"
    for            = "2m"

    annotations = {
      summary = "Lambda function is experiencing errors"
    }
    labels = {
      severity = "critical"
      service  = "lambda-backend"
    }

    data {
      ref_id         = "A"
      query_type     = ""
      datasource_uid = grafana_data_source.cloudwatch_source.uid
      relative_time_range {
        from = 300 # 5 minutes
        to   = 0
      }
      model = jsonencode({
        namespace  = "AWS/Lambda"
        metricName = "Errors"
        region     = var.aws_region
        statistic  = "Sum"
        dimensions = {
          FunctionName = var.server_function_name
        }
        period        = "60"
        refId         = "A"
        hide          = false
        intervalMs    = 1000
        maxDataPoints = 43200
      })
    }

    data {
      ref_id         = "B"
      query_type     = ""
      datasource_uid = "-100"
      relative_time_range {
        from = 0
        to   = 0
      }
      model = jsonencode({
        conditions = [{
          evaluator = {
            params = [0]
            type   = "gt"
          }
          operator = {
            type = "and"
          }
          query = {
            params = ["A"]
          }
          reducer = {
            params = []
            type   = "last"
          }
          type = "query"
        }]
        datasource = {
          name = "Expression"
          type = "__expr__"
          uid  = "-100"
        }
        hide          = false
        intervalMs    = 1000
        maxDataPoints = 43200
        refId         = "B"
        type          = "classic_conditions"
      })
    }

    notification_settings {
      contact_point = grafana_contact_point.slack.name
    }
  }
}
