data "aws_caller_identity" "current" {}

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/lambda/metrics_publisher.zip"
  excludes    = ["metrics_publisher.zip"]
}

# -------------------------
# IAM Role
# -------------------------
resource "aws_iam_role" "metrics_publisher" {
  name = "${var.environment}-metrics-publisher-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })

  tags = {
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "terraform"
    Component   = "grafana-metrics-publisher"
  }
}

resource "aws_iam_role_policy" "metrics_publisher" {
  name = "${var.environment}-metrics-publisher-policy"
  role = aws_iam_role.metrics_publisher.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "RDSIAMAuth"
        Effect   = "Allow"
        Action   = ["rds-db:connect"]
        Resource = "arn:aws:rds-db:${var.aws_region}:${data.aws_caller_identity.current.account_id}:dbuser:${var.aurora_cluster_resource_id}/metrics_publisher"
      },
      {
        Sid      = "CloudWatchMetrics"
        Effect   = "Allow"
        Action   = ["cloudwatch:PutMetricData"]
        Resource = "*"
        Condition = {
          StringEquals = {
            "cloudwatch:namespace" = "OpenJII/UserRegistrations"
          }
        }
      },
      {
        Sid    = "VPCNetworking"
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = "*"
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.environment}-metrics-publisher:*"
      }
    ]
  })
}

# -------------------------
# Lambda Function
# -------------------------
resource "aws_lambda_function" "metrics_publisher" {
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  function_name    = "${var.environment}-metrics-publisher"
  role             = aws_iam_role.metrics_publisher.arn
  handler          = "index.handler"
  runtime          = "nodejs22.x"
  timeout          = 60

  vpc_config {
    subnet_ids         = var.private_subnets
    security_group_ids = [var.metrics_publisher_lambda_sg_id]
  }

  environment {
    variables = {
      DB_HOST              = var.db_host
      DB_PORT              = tostring(var.db_port)
      DB_NAME              = var.db_name
      DB_USER              = "metrics_publisher"
      AURORA_RESOURCE_ID   = var.aurora_cluster_resource_id
      AWS_RDS_REGION       = var.aws_region
      CLOUDWATCH_NAMESPACE = "OpenJII/UserRegistrations"
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "terraform"
    Component   = "grafana-metrics-publisher"
  }
}

# -------------------------
# EventBridge Schedule (weekly on Monday 06:00 UTC)
# -------------------------
resource "aws_cloudwatch_event_rule" "metrics_publisher" {
  name                = "${var.environment}-metrics-publisher-schedule"
  description         = "Trigger metrics-publisher Lambda weekly to push user registration stats to CloudWatch"
  schedule_expression = "cron(0 6 ? * MON *)"

  tags = {
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "terraform"
    Component   = "grafana-metrics-publisher"
  }
}

resource "aws_cloudwatch_event_target" "metrics_publisher" {
  rule      = aws_cloudwatch_event_rule.metrics_publisher.name
  target_id = "MetricsPublisherLambda"
  arn       = aws_lambda_function.metrics_publisher.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.metrics_publisher.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.metrics_publisher.arn
}
