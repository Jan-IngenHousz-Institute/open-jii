data "aws_caller_identity" "current" {}

locals {
  alb_arn_suffix = element(split("loadbalancer/", var.alb_arn), 1)

  macro_function_filter = join(" OR ", [
    for name in var.macro_function_names : "FunctionName=\"${name}\""
  ])

  digests = {
    observability = { schedule = "cron(30 6 * * ? *)" }
    pulse         = { schedule = "cron(35 6 * * ? *)" }
    weekly        = { schedule = "cron(0 7 ? * MON *)" }
  }

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "digest-composer"
  }
}

resource "aws_iam_role" "digest_composer" {
  name = "${var.environment}-digest-composer-lambda-role"

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

resource "aws_iam_role_policy" "digest_composer" {
  name = "${var.environment}-digest-composer-policy"
  role = aws_iam_role.digest_composer.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchRead"
        Effect = "Allow"
        Action = [
          "cloudwatch:GetMetricData"
        ]
        # GetMetricData does not support resource-level permissions
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
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.environment}-digest-composer:*"
      }
    ]
  })
}

resource "aws_lambda_function" "digest_composer" {
  filename         = "${path.module}/lambda/function.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda/function.zip")
  function_name    = "${var.environment}-digest-composer"
  role             = aws_iam_role.digest_composer.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  timeout          = 120
  memory_size      = 256

  environment {
    variables = {
      ENVIRONMENT                = var.environment
      KINESIS_STREAM_NAME        = var.kinesis_stream_name
      ALB_ARN_SUFFIX             = local.alb_arn_suffix
      CLOUDFRONT_DISTRIBUTION_ID = var.cloudfront_distribution_id
      SERVER_FUNCTION_NAME       = var.server_function_name
      MACRO_FUNCTION_FILTER      = local.macro_function_filter
      DB_CLUSTER_IDENTIFIER      = var.db_cluster_identifier
      HEARTBEAT_WEBHOOK_URL      = var.heartbeat_webhook_url
      USAGE_WEBHOOK_URL          = var.usage_webhook_url
      RUNBOOK_BASE_URL           = var.runbook_base_url
    }
  }

  tags = local.tags
}

resource "aws_cloudwatch_event_rule" "digest" {
  for_each = local.digests

  name                = "${var.environment}-digest-composer-${each.key}"
  description         = "Trigger the ${each.key} digest"
  schedule_expression = each.value.schedule

  tags = local.tags
}

resource "aws_cloudwatch_event_target" "digest" {
  for_each = local.digests

  rule      = aws_cloudwatch_event_rule.digest[each.key].name
  target_id = "DigestComposerLambda"
  arn       = aws_lambda_function.digest_composer.arn
  input     = jsonencode({ digest = each.key })
}

resource "aws_lambda_permission" "digest" {
  for_each = local.digests

  statement_id  = "AllowEventBridge${title(each.key)}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.digest_composer.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.digest[each.key].arn
}
