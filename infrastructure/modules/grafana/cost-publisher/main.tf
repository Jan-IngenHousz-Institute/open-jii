data "aws_caller_identity" "current" {}

locals {
  namespace = "OpenJII/Cost"

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "cost-publisher"
  }
}

resource "aws_iam_role" "cost_publisher" {
  name = "${var.environment}-cost-publisher-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })

  tags = local.tags
}

resource "aws_iam_role_policy" "cost_publisher" {
  name = "${var.environment}-cost-publisher-policy"
  role = aws_iam_role.cost_publisher.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Cost Explorer has no resource-level permissions, so these two reads cannot be narrowed.
        Sid      = "ReadCosts"
        Effect   = "Allow"
        Action   = ["ce:GetCostAndUsage", "ce:GetCostForecast"]
        Resource = "*"
      },
      {
        Sid      = "PublishMetrics"
        Effect   = "Allow"
        Action   = ["cloudwatch:PutMetricData"]
        Resource = "*"
        Condition = {
          StringEquals = {
            "cloudwatch:namespace" = local.namespace
          }
        }
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.cost_publisher.arn}:*"
      }
    ]
  })
}

# Declared up front: a group the Lambda auto-creates cannot be adopted later without an
# import, and it would keep every line forever.
resource "aws_cloudwatch_log_group" "cost_publisher" {
  name              = "/aws/lambda/${var.environment}-cost-publisher"
  retention_in_days = var.log_retention_days

  tags = local.tags
}

resource "aws_lambda_function" "cost_publisher" {
  filename         = "${path.module}/lambda/function.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda/function.zip")
  function_name    = "${var.environment}-cost-publisher"
  role             = aws_iam_role.cost_publisher.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  timeout          = 60
  memory_size      = 256

  environment {
    variables = {
      ENVIRONMENT = var.environment
    }
  }

  tags = local.tags

  depends_on = [aws_cloudwatch_log_group.cost_publisher]
}

# Cost Explorer refreshes its figures a few times a day, so a daily run loses nothing, and each
# request costs a cent. 06:00 UTC lands the week that closed at midnight before the weekly
# report is read on Monday morning.
resource "aws_cloudwatch_event_rule" "cost_publisher" {
  name                = "${var.environment}-cost-publisher-schedule"
  description         = "Publish Cost Explorer's spend to CloudWatch once a day"
  schedule_expression = "cron(0 6 * * ? *)"

  tags = local.tags
}

resource "aws_cloudwatch_event_target" "cost_publisher" {
  rule      = aws_cloudwatch_event_rule.cost_publisher.name
  target_id = "CostPublisherLambda"
  arn       = aws_lambda_function.cost_publisher.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id   = "AllowExecutionFromEventBridge"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.cost_publisher.function_name
  principal      = "events.amazonaws.com"
  source_arn     = aws_cloudwatch_event_rule.cost_publisher.arn
  source_account = data.aws_caller_identity.current.account_id
}
