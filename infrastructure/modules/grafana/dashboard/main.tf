terraform {
  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = ">= 4.2.1"
    }
  }
}

# Create a CloudWatch data source in AMG
resource "grafana_data_source" "cloudwatch_source" {
  provider   = grafana
  type       = "cloudwatch"
  name       = "cw-datasource"
  is_default = true

  json_data_encoded = jsonencode({
    defaultRegion = var.aws_region
    authType      = "default" # AMG uses SigV4 with the workspace role
  })
}

resource "grafana_folder" "folder" {
  title = "${var.environment} Dashboards"
  uid   = "${var.environment}-dashboards"
}

resource "grafana_dashboard" "dashboard" {
  provider  = grafana
  folder    = grafana_folder.folder.id
  overwrite = true

  # Note: This is a trimmed JSON. You can add more panels and customize queries.
  # Panels use CloudWatch metrics with the CloudWatch data source.
  config_json = jsonencode({
    title = "${var.project} - SRE Overview"
    time  = { from = "now-6h", to = 0 }
    panels = [
      # Lambda Errors
      {
        type = "timeseries", title = "Lambda Errors (sum)", span = 12, datasource = { type = "cloudwatch", uid = grafana_data_source.cloudwatch_source.uid },
        targets = [
          {
            namespace  = "AWS/Lambda",
            metricName = "Errors",
            region     = var.aws_region,
            statistic  = "Sum",
            dimensions = { FunctionName = var.server_function_name }
          }
        ]
      },
      # ALB Target 5xx
      {
        type = "timeseries", title = "ALB Target 5xx (sum)", span = 12, datasource = { type = "cloudwatch", uid = grafana_data_source.cloudwatch_source.uid },
        targets = [
          {
            namespace  = "AWS/ApplicationELB",
            metricName = "HTTPCode_Target_5XX_Count",
            region     = var.aws_region,
            statistic  = "Sum",
            dimensions = {
              LoadBalancer = var.load_balancer_arn
              TargetGroup  = var.target_group_arn
            }
          }
        ]
      },
      # ECS CPU
      {
        type = "timeseries", title = "ECS Service CPU (%)", span = 12, datasource = { type = "cloudwatch", uid = grafana_data_source.cloudwatch_source.uid },
        targets = [
          {
            namespace  = "AWS/ECS",
            metricName = "CPUUtilization",
            region     = var.aws_region,
            statistic  = "Average",
            dimensions = { ClusterName = var.ecs_cluster_name, ServiceName = var.ecs_service_name }
          }
        ]
      },
      # CloudFront Error Rate
      {
        type = "timeseries", title = "CloudFront Total Error Rate (%)", span = 12, datasource = { type = "cloudwatch", uid = grafana_data_source.cloudwatch_source.uid },
        targets = [
          {
            namespace  = "AWS/CloudFront",
            metricName = "TotalErrorRate",
            region     = "Global",
            statistic  = "Average",
            dimensions = { DistributionId = var.cloudfront_distribution_id }
          }
        ]
      }
    ]
    schemaVersion = 36
    version       = 1
  })
}

### Alerting rules 

resource "grafana_contact_point" "slack" {
  provider = grafana
  name     = "slack"

  slack {
    url = var.slack_webhook_url
  }

  lifecycle {
    ignore_changes = [slack] # if you store the webhook securely outside TF
  }
}

resource "grafana_folder" "alerts" {
  provider = grafana
  title    = "${var.environment} Alerting"
}

# Rule group with one example rule: ALB Target 5xx > 5 in last 5m
resource "grafana_rule_group" "alb_5xx" {
  provider         = grafana
  org_id           = 1
  folder_uid       = grafana_folder.alerts.uid
  name             = "ALB errors"
  interval_seconds = 60

  rule {
    name      = "High ALB Target 5xx (sum > 5 in 5m)"
    condition = "A"

    data {
      ref_id         = "A"
      datasource_uid = grafana_data_source.cloudwatch_source.uid
      model = jsonencode({
        namespace  = "AWS/ApplicationELB",
        metricName = "HTTPCode_Target_5XX_Count",
        region     = var.aws_region,
        statistic  = "Sum",
        dimensions = {
          LoadBalancer = var.load_balancer_arn
          TargetGroup  = var.target_group_arn
        },
        # Reduce over last 5 minutes
        period     = "60",
        expression = "",
        refId      = "A",
        type       = "timeseries"
      })
      relative_time_range {
        from = 300 # 5 minutes
        to   = 0
      }
    }

    no_data_state  = "NoData"
    exec_err_state = "Error"
    annotations    = { runbook = "https://your.runbook.link" }
    labels         = { severity = "high", service = "backend" }

    for = "2m"

    notification_settings {
      contact_point = grafana_contact_point.slack.name
    }
  }
}

resource "grafana_rule_group" "cloudfront_site_down" {
  provider         = grafana
  org_id           = 1
  folder_uid       = grafana_folder.alerts.uid
  name             = "CloudFront Site Down"
  interval_seconds = 60

  rule {
    name      = "High CloudFront Error Rate"
    condition = "A"

    data {
      ref_id         = "A"
      datasource_uid = grafana_data_source.cloudwatch_source.uid
      model = jsonencode({
        namespace  = "AWS/CloudFront",
        metricName = "TotalErrorRate",
        region     = "Global",
        statistic  = "Average",
        dimensions = {
          DistributionId = var.cloudfront_distribution_id
        },
        period = "60",
        refId  = "A",
        type   = "timeseries"
      })
      relative_time_range {
        from = 300 # 5 minutes
        to   = 0
      }
    }

    # Alert if error rate > 5% for 2 minutes
    for            = "2m"
    no_data_state  = "Alerting"
    exec_err_state = "Error"
    annotations    = { runbook = "https://your.runbook.link" }
    labels         = { severity = "critical", service = "frontend" }

    notification_settings {
      contact_point = grafana_contact_point.slack.name
    }
  }
}

resource "grafana_rule_group" "lambda_errors" {
  provider         = grafana
  org_id           = 1
  folder_uid       = grafana_folder.alerts.uid
  name             = "Lambda Errors"
  interval_seconds = 60

  rule {
    name      = "High Lambda Error Count"
    condition = "A"

    data {
      ref_id         = "A"
      datasource_uid = grafana_data_source.cloudwatch_source.uid
      model = jsonencode({
        namespace  = "AWS/Lambda",
        metricName = "Errors",
        region     = var.aws_region,
        statistic  = "Sum",
        dimensions = {
          FunctionName = var.server_function_name
        },
        period = "60",
        refId  = "A",
        type   = "timeseries"
      })
      relative_time_range {
        from = 300 # 5 minutes
        to   = 0
      }
    }

    # Alert if errors > 0 for 2 minutes
    for            = "2m"
    no_data_state  = "Alerting"
    exec_err_state = "Error"
    annotations    = { runbook = "https://your.runbook.link" }
    labels         = { severity = "critical", service = "lambda-backend" }

    notification_settings {
      contact_point = grafana_contact_point.slack.name
    }
  }
}
