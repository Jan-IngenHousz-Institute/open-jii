data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_iot_endpoint" "data" {
  endpoint_type = "iot:Data-ATS"
}

locals {
  # Matches the lean ingest rule's experiment/data_ingest/v1/+/+/+/+ filter, so the message takes the
  # real rule to Kinesis and the archive. The experiment segment is the id bronze drops by, which
  # INGEST_HEALTHCHECK_EXPERIMENT_ID in apps/data's centrum constants must equal.
  topic = "experiment/data_ingest/v1/healthcheck/healthcheck/1/${var.environment}"

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "ingest-healthcheck"
  }
}

resource "aws_iam_role" "ingest_healthcheck" {
  name = "${var.environment}-ingest-healthcheck-lambda-role"

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

resource "aws_iam_role_policy" "ingest_healthcheck" {
  name = "${var.environment}-ingest-healthcheck-policy"
  role = aws_iam_role.ingest_healthcheck.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "PublishHealthcheck"
        Effect   = "Allow"
        Action   = ["iot:Publish"]
        Resource = "arn:aws:iot:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:topic/${local.topic}"
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.ingest_healthcheck.arn}:*"
      }
    ]
  })
}

# Declared up front: a group the Lambda auto-creates cannot be adopted later without an
# import, and it would keep every line forever.
resource "aws_cloudwatch_log_group" "ingest_healthcheck" {
  name              = "/aws/lambda/${var.environment}-ingest-healthcheck"
  retention_in_days = var.log_retention_days

  tags = local.tags
}

# One run at a time: an overlapping run would publish two messages in one minute and read as a
# healthier path than it is.
resource "aws_lambda_function" "ingest_healthcheck" {
  filename                       = "${path.module}/lambda/function.zip"
  source_code_hash               = filebase64sha256("${path.module}/lambda/function.zip")
  function_name                  = "${var.environment}-ingest-healthcheck"
  role                           = aws_iam_role.ingest_healthcheck.arn
  handler                        = "index.handler"
  runtime                        = "nodejs24.x"
  timeout                        = 10
  memory_size                    = 128
  reserved_concurrent_executions = 1

  environment {
    variables = {
      ENVIRONMENT       = var.environment
      IOT_DATA_ENDPOINT = "https://${data.aws_iot_endpoint.data.endpoint_address}"
      TOPIC             = local.topic
    }
  }

  tags = local.tags

  depends_on = [aws_cloudwatch_log_group.ingest_healthcheck]
}

# A failed run is not retried and a delayed one is dropped: a message sent late would stamp an
# older send time than the path's real delay, and a retry would hide the failure the next run
# is there to show.
resource "aws_lambda_function_event_invoke_config" "ingest_healthcheck" {
  function_name                = aws_lambda_function.ingest_healthcheck.function_name
  maximum_retry_attempts       = 0
  maximum_event_age_in_seconds = 60
}

resource "aws_cloudwatch_event_rule" "ingest_healthcheck" {
  name                = "${var.environment}-ingest-healthcheck-schedule"
  description         = "Publish a synthetic message through the ingest rule every minute"
  schedule_expression = "rate(1 minute)"
  # Off until the pipeline that splits health checks out of bronze is live, since bronze keeps
  # every row it ever takes.
  state = var.publishing_enabled ? "ENABLED" : "DISABLED"

  tags = local.tags
}

resource "aws_cloudwatch_event_target" "ingest_healthcheck" {
  rule      = aws_cloudwatch_event_rule.ingest_healthcheck.name
  target_id = "IngestHealthcheckLambda"
  arn       = aws_lambda_function.ingest_healthcheck.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id   = "AllowExecutionFromEventBridge"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.ingest_healthcheck.function_name
  principal      = "events.amazonaws.com"
  source_arn     = aws_cloudwatch_event_rule.ingest_healthcheck.arn
  source_account = data.aws_caller_identity.current.account_id
}
