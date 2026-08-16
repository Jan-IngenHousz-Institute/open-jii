data "aws_caller_identity" "current" {}

locals {
  namespaces = ["OpenJII/Ingest", "OpenJII/Data", "OpenJII/Usage"]

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "metrics-forwarder"
  }
}

resource "aws_iam_role" "metrics_forwarder" {
  name = "${var.environment}-metrics-forwarder-lambda-role"

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

resource "aws_iam_role_policy" "metrics_forwarder" {
  name = "${var.environment}-metrics-forwarder-policy"
  role = aws_iam_role.metrics_forwarder.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadHeartbeatObjects"
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${var.heartbeat_bucket_arn}/${var.heartbeat_prefix}*"
      },
      {
        Sid      = "PublishMetrics"
        Effect   = "Allow"
        Action   = ["cloudwatch:PutMetricData"]
        Resource = "*"
        Condition = {
          StringEquals = {
            "cloudwatch:namespace" = local.namespaces
          }
        }
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.environment}-metrics-forwarder:*"
      }
    ]
  })
}

# Lets the Unity Catalog storage-credential role write heartbeat files; attach the
# ARN to that credential's additional_policy_arns
resource "aws_iam_policy" "databricks_write" {
  name = "open_jii_${var.environment}_databricks_heartbeat_write"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:GetBucketLocation"
        ]
        Resource = [var.heartbeat_bucket_arn, "${var.heartbeat_bucket_arn}/*"]
      }
    ]
  })
}

resource "aws_lambda_function" "metrics_forwarder" {
  filename         = "${path.module}/lambda/function.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda/function.zip")
  function_name    = "${var.environment}-metrics-forwarder"
  role             = aws_iam_role.metrics_forwarder.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  timeout          = 60
  memory_size      = 256

  tags = local.tags
}

resource "aws_lambda_permission" "allow_s3" {
  statement_id   = "AllowExecutionFromS3"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.metrics_forwarder.function_name
  principal      = "s3.amazonaws.com"
  source_arn     = var.heartbeat_bucket_arn
  source_account = data.aws_caller_identity.current.account_id
}

resource "aws_s3_bucket_notification" "heartbeat" {
  bucket = var.heartbeat_bucket_id

  lambda_function {
    lambda_function_arn = aws_lambda_function.metrics_forwarder.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = var.heartbeat_prefix
    filter_suffix       = ".json"
  }

  depends_on = [aws_lambda_permission.allow_s3]
}
