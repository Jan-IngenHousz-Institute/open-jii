mock_provider "aws" {}

mock_provider "grafana" {
  alias = "amg"
}

run "macro_failure_alert_contract" {
  command = plan

  variables {
    aws_region                 = "eu-west-1"
    environment                = "prod"
    server_function_name       = "server-prod"
    load_balancer_arn          = "arn:aws:elasticloadbalancing:eu-west-1:123456789012:loadbalancer/app/backend/1234567890abcdef"
    target_group_arn           = "arn:aws:elasticloadbalancing:eu-west-1:123456789012:targetgroup/backend/1234567890abcdef"
    ecs_cluster_name           = "backend-prod"
    ecs_service_name           = "backend-service-prod"
    cloudfront_distribution_id = "E1234567890"
    slack_webhook_url          = "https://hooks.slack.test/services/test"
    db_cluster_identifier      = "open-jii-prod-db-cluster"
    kinesis_stream_name        = "open-jii-prod-data-ingest-stream"
    ecs_log_group_name         = "/aws/ecs/backend-service-prod"

    enable_macro_failure_alert    = true
    macro_batch_failure_threshold = 10
  }

  assert {
    condition     = aws_cloudwatch_log_metric_filter.macro_batch_failures[0].log_group_name == "/aws/ecs/backend-service-prod"
    error_message = "The metric filter must target the production backend log group."
  }

  assert {
    condition = (
      aws_cloudwatch_log_metric_filter.macro_batch_failures[0].metric_transformation[0].value == "$.failureCount" &&
      aws_cloudwatch_log_metric_filter.macro_batch_failures[0].metric_transformation[0].namespace == "OpenJII/MacroExecution"
    )
    error_message = "The metric filter must publish failureCount to the macro execution namespace."
  }

  assert {
    condition = one([
      for rule in grafana_rule_group.backend_alerts.rule : rule
      if rule.name == "Macro Batch Failures High"
    ]).condition == "C"
    error_message = "The macro alert must evaluate query C."
  }

  assert {
    condition = (
      jsondecode(one([
        for data in one([
          for rule in grafana_rule_group.backend_alerts.rule : rule
          if rule.name == "Macro Batch Failures High"
        ]).data : data if data.ref_id == "A"
      ]).model).statistic == "Sum" &&
      jsondecode(one([
        for data in one([
          for rule in grafana_rule_group.backend_alerts.rule : rule
          if rule.name == "Macro Batch Failures High"
        ]).data : data if data.ref_id == "A"
      ]).model).period == "60" &&
      jsondecode(one([
        for data in one([
          for rule in grafana_rule_group.backend_alerts.rule : rule
          if rule.name == "Macro Batch Failures High"
        ]).data : data if data.ref_id == "A"
      ]).model).expression == "FILL(m1, 0)"
    )
    error_message = "Query A must be a 60-second CloudWatch Sum series using FILL(m1, 0)."
  }

  assert {
    condition = (
      jsondecode(one([
        for data in one([
          for rule in grafana_rule_group.backend_alerts.rule : rule
          if rule.name == "Macro Batch Failures High"
        ]).data : data if data.ref_id == "B"
      ]).model).type == "reduce" &&
      jsondecode(one([
        for data in one([
          for rule in grafana_rule_group.backend_alerts.rule : rule
          if rule.name == "Macro Batch Failures High"
        ]).data : data if data.ref_id == "B"
      ]).model).expression == "A" &&
      jsondecode(one([
        for data in one([
          for rule in grafana_rule_group.backend_alerts.rule : rule
          if rule.name == "Macro Batch Failures High"
        ]).data : data if data.ref_id == "B"
      ]).model).reducer == "sum"
    )
    error_message = "Query B must reduce query A using sum."
  }

  assert {
    condition = (
      jsondecode(one([
        for data in one([
          for rule in grafana_rule_group.backend_alerts.rule : rule
          if rule.name == "Macro Batch Failures High"
        ]).data : data if data.ref_id == "C"
      ]).model).type == "math" &&
      jsondecode(one([
        for data in one([
          for rule in grafana_rule_group.backend_alerts.rule : rule
          if rule.name == "Macro Batch Failures High"
        ]).data : data if data.ref_id == "C"
      ]).model).expression == "$B > ${var.macro_batch_failure_threshold}"
    )
    error_message = "Query C must compare B with the configured threshold."
  }

  assert {
    condition = (
      one([
        for rule in grafana_rule_group.backend_alerts.rule : rule
        if rule.name == "Macro Batch Failures High"
      ]).labels.severity == "critical" &&
      one([
        for rule in grafana_rule_group.backend_alerts.rule : rule
        if rule.name == "Macro Batch Failures High"
      ]).labels.service == "macro-execution"
    )
    error_message = "The macro alert must carry critical severity and macro-execution service labels."
  }

  assert {
    condition = (
      grafana_notification_policy.policy.contact_point == grafana_contact_point.slack.name &&
      contains(grafana_notification_policy.policy.group_by, "service") &&
      anytrue([
        for policy in grafana_notification_policy.policy.policy :
        policy.contact_point == grafana_contact_point.slack.name && anytrue([
          for matcher in policy.matcher :
          matcher.label == "severity" && matcher.match == "=" && matcher.value == "critical"
        ])
      ])
    )
    error_message = "The critical macro alert labels must participate in the existing Slack notification policy."
  }
}
