data "aws_caller_identity" "current" {}

locals {
  # The CloudWatch LoadBalancer dimension is the ARN's trailing resource path.
  alb_arn_suffix = element(split("loadbalancer/", var.load_balancer_arn), 1)

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "status-publisher"
  }
}

resource "aws_iam_role" "status_publisher" {
  name = "${var.environment}-status-publisher-lambda-role"

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

resource "aws_iam_role_policy" "status_publisher" {
  name = "${var.environment}-status-publisher-policy"
  role = aws_iam_role.status_publisher.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # GetMetricData has no resource-level permissions, so this read cannot be narrowed.
        Sid      = "ReadMetrics"
        Effect   = "Allow"
        Action   = ["cloudwatch:GetMetricData"]
        Resource = "*"
      },
      {
        Sid      = "ReadAndWriteState"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject"]
        Resource = "${var.state_bucket_arn}/publisher-state.json"
      },
      {
        # Without it S3 answers a read of a key that does not exist yet with AccessDenied, not NoSuchKey.
        Sid      = "ListState"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = var.state_bucket_arn
      },
      {
        Sid      = "PublishStatusData"
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = "${var.site_bucket_arn}/data/*"
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.status_publisher.arn}:*"
      }
    ]
  })
}

# Declared up front: a group the Lambda auto-creates cannot be adopted later without an
# import, and it would keep every line forever.
resource "aws_cloudwatch_log_group" "status_publisher" {
  name              = "/aws/lambda/${var.environment}-status-publisher"
  retention_in_days = var.log_retention_days

  tags = local.tags
}

# Reserved concurrency of one keeps a slow run from racing the next on the state file.
resource "aws_lambda_function" "status_publisher" {
  filename                       = "${path.module}/lambda/function.zip"
  source_code_hash               = filebase64sha256("${path.module}/lambda/function.zip")
  function_name                  = "${var.environment}-status-publisher"
  role                           = aws_iam_role.status_publisher.arn
  handler                        = "index.handler"
  runtime                        = "nodejs24.x"
  timeout                        = 50
  memory_size                    = 256
  reserved_concurrent_executions = 1

  environment {
    variables = {
      ENVIRONMENT         = var.environment
      SITE_BUCKET         = var.site_bucket_id
      STATE_BUCKET        = var.state_bucket_id
      WEB_URL             = var.web_url
      API_HEALTH_URL      = var.api_health_url
      ALB_ARN_SUFFIX      = local.alb_arn_suffix
      WEB_DISTRIBUTION_ID = var.web_distribution_id
      KINESIS_STREAM_NAME = var.kinesis_stream_name
    }
  }

  tags = local.tags

  depends_on = [aws_cloudwatch_log_group.status_publisher]
}

# The next run is a minute away, so a failed minute is not retried and an event that waited
# behind a slow run is dropped rather than judged late.
resource "aws_lambda_function_event_invoke_config" "status_publisher" {
  function_name                = aws_lambda_function.status_publisher.function_name
  maximum_retry_attempts       = 0
  maximum_event_age_in_seconds = 60
}

resource "aws_cloudwatch_event_rule" "status_publisher" {
  name                = "${var.environment}-status-publisher-schedule"
  description         = "Run the status publisher every minute"
  schedule_expression = "rate(1 minute)"

  tags = local.tags
}

resource "aws_cloudwatch_event_target" "status_publisher" {
  rule      = aws_cloudwatch_event_rule.status_publisher.name
  target_id = "StatusPublisherLambda"
  arn       = aws_lambda_function.status_publisher.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id   = "AllowExecutionFromEventBridge"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.status_publisher.function_name
  principal      = "events.amazonaws.com"
  source_arn     = aws_cloudwatch_event_rule.status_publisher.arn
  source_account = data.aws_caller_identity.current.account_id
}
