data "aws_partition" "current" {}
data "aws_caller_identity" "current" {}

resource "aws_iam_role" "iot_cloudwatch_role" {
  name = var.cloudwatch_role_name
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "iot.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_policy" "iot_cloudwatch_policy" {
  name = var.cloudwatch_policy_name
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:PutMetricFilter",
          "logs:PutRetentionPolicy",
          "iot:GetLoggingOptions",
          "iot:SetLoggingOptions",
          "iot:SetV2LoggingOptions",
          "iot:GetV2LoggingOptions",
          "iot:SetV2LoggingLevel",
          "iot:ListV2LoggingLevels",
          "iot:DeleteV2LoggingLevel"
        ],
        Resource = [
          "arn:${data.aws_partition.current.partition}:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:AWSIotLogsV2:*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "iot_cloudwatch_attach" {
  role       = aws_iam_role.iot_cloudwatch_role.name
  policy_arn = aws_iam_policy.iot_cloudwatch_policy.arn
}


# SNS Topic for IoT Connection Alerts
resource "aws_sns_topic" "iot_alerts" {
  name = var.iot_alerts_topic_name
  tags = {
    Name        = var.iot_alerts_topic_name
    Description = "SNS topic for IoT alerts"
  }
}

# CloudWatch Metric Alarm for IoT Connection Failure Rate
resource "aws_cloudwatch_metric_alarm" "iot_connection_failure_rate" {
  alarm_name          = "IoTConnectionFailureRate"
  alarm_description   = "Alarm when IoT connection failure rate exceeds threshold"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 10 # 10% failure rate
  alarm_actions       = [aws_sns_topic.iot_alerts.arn]
  ok_actions          = [aws_sns_topic.iot_alerts.arn]
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "e1"
    expression  = "m2/(m1+m2+0.001)*100" # Adding small value to prevent division by zero
    label       = "Connection Failure Rate (%)"
    return_data = true
  }

  metric_query {
    id = "m1"
    metric {
      metric_name = "Connect.Success"
      namespace   = "AWS/IoT"
      period      = 3600 # 1 hour
      stat        = "Sum"
      dimensions = {
        Protocol = "MQTT"
      }
    }
  }

  metric_query {
    id = "m2"
    metric {
      metric_name = "Connect.Failure"
      namespace   = "AWS/IoT"
      period      = 3600 # 1 hour
      stat        = "Sum"
      dimensions = {
        Protocol = "MQTT"
      }
    }
  }
}

# CloudWatch Metric Alarm for IoT Rule Execution Failures
resource "aws_cloudwatch_metric_alarm" "iot_rule_execution_failures" {
  alarm_name          = "IoTRuleExecutionFailure"
  alarm_description   = "Alarm when IoT rules fail to execute properly"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "RuleExecutionFailure"
  namespace           = "AWS/IoT"
  period              = 300 # 5 minutes
  statistic           = "Sum"
  threshold           = 5 # Alert if 5+ failures in 5 minutes                                       
  alarm_actions       = [aws_sns_topic.iot_alerts.arn]
  ok_actions          = [aws_sns_topic.iot_alerts.arn]
  treat_missing_data  = "notBreaching"
}

# CloudWatch Metric Alarm for Message Throttling
resource "aws_cloudwatch_metric_alarm" "iot_message_throttling" {
  alarm_name          = "IoTMessageThrottling"
  alarm_description   = "Alarm when IoT messages are being throttled"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "PublishIn.Throttle"
  namespace           = "AWS/IoT"
  period              = 300 # 5 minutes
  statistic           = "Sum"
  threshold           = 10 # Alert on 10+ throttled messages in 5 minutes
  alarm_actions       = [aws_sns_topic.iot_alerts.arn]
  ok_actions          = [aws_sns_topic.iot_alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    Protocol = "MQTT"
  }
}

# CloudWatch Metric Alarm for Publish Errors
resource "aws_cloudwatch_metric_alarm" "iot_publish_errors" {
  alarm_name          = "IoTPublishErrors"
  alarm_description   = "Alarm when IoT message publishing encounters errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 5 # Percent of failed publishes
  alarm_actions       = [aws_sns_topic.iot_alerts.arn]
  ok_actions          = [aws_sns_topic.iot_alerts.arn]
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "e1"
    expression  = "(m2+m3+m4)/(m1+m2+m3+m4+0.001)*100" # Error percentage
    label       = "Publish Error Rate (%)"
    return_data = true
  }

  metric_query {
    id = "m1"
    metric {
      metric_name = "PublishIn.Success"
      namespace   = "AWS/IoT"
      period      = 300 # 5 minutes
      stat        = "Sum"
      dimensions = {
        Protocol = "MQTT"
      }
    }
  }

  metric_query {
    id = "m2"
    metric {
      metric_name = "PublishIn.AuthError"
      namespace   = "AWS/IoT"
      period      = 300
      stat        = "Sum"
      dimensions = {
        Protocol = "MQTT"
      }
    }
  }

  metric_query {
    id = "m3"
    metric {
      metric_name = "PublishIn.ClientError"
      namespace   = "AWS/IoT"
      period      = 300
      stat        = "Sum"
      dimensions = {
        Protocol = "MQTT"
      }
    }
  }

  metric_query {
    id = "m4"
    metric {
      metric_name = "PublishIn.ServerError"
      namespace   = "AWS/IoT"
      period      = 300
      stat        = "Sum"
      dimensions = {
        Protocol = "MQTT"
      }
    }
  }
}

