locals {
  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "status-slack"
  }
}

resource "aws_iam_role" "status_slack" {
  name = "${var.environment}-status-slack-lambda-role"

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

resource "aws_iam_role_policy" "status_slack" {
  name = "${var.environment}-status-slack-policy"
  role = aws_iam_role.status_slack.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadWebhookSecret"
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = var.webhook_secret_arn
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.status_slack.arn}:*"
      }
    ]
  })
}

# Declared up front: a group the Lambda auto-creates cannot be adopted later without an
# import, and it would keep every line forever.
resource "aws_cloudwatch_log_group" "status_slack" {
  name              = "/aws/lambda/${var.environment}-status-slack"
  retention_in_days = var.log_retention_days

  tags = local.tags
}

# Reserved concurrency of one posts messages one at a time, which keeps them roughly in order.
resource "aws_lambda_function" "status_slack" {
  filename                       = "${path.module}/lambda/function.zip"
  source_code_hash               = filebase64sha256("${path.module}/lambda/function.zip")
  function_name                  = "${var.environment}-status-slack"
  role                           = aws_iam_role.status_slack.arn
  handler                        = "index.handler"
  runtime                        = "nodejs24.x"
  timeout                        = 30
  memory_size                    = 128
  reserved_concurrent_executions = 1

  environment {
    variables = {
      STATUS_SLACK_SECRET_ARN = var.webhook_secret_arn
    }
  }

  tags = local.tags

  depends_on = [aws_cloudwatch_log_group.status_slack]
}

# SNS invokes the function asynchronously. A failed post is tried twice more, a minute and two
# minutes later, and an event that waited more than an hour is dropped rather than posted late.
resource "aws_lambda_function_event_invoke_config" "status_slack" {
  function_name                = aws_lambda_function.status_slack.function_name
  maximum_retry_attempts       = 2
  maximum_event_age_in_seconds = 3600
}

resource "aws_lambda_permission" "allow_sns" {
  statement_id  = "AllowExecutionFromSns"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.status_slack.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = var.events_topic_arn
}

resource "aws_sns_topic_subscription" "status_slack" {
  topic_arn = var.events_topic_arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.status_slack.arn

  depends_on = [aws_lambda_permission.allow_sns]
}
