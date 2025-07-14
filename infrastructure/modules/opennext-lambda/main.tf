# Create a placeholder zip file for initial deployment if no package provided
data "archive_file" "empty_package" {
  count       = var.lambda_package_path == null ? 1 : 0
  type        = "zip"
  output_path = "${path.module}/empty-function.zip"

  source {
    content  = "exports.handler = async (event) => { return { statusCode: 200, body: 'Placeholder function' }; };"
    filename = "index.js"
  }
}

# IAM role for Lambda function
resource "aws_iam_role" "lambda_role" {
  name = "${var.function_name}-role"
  tags = var.tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# Basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.lambda_role.name
}

# VPC execution policy (conditional)
resource "aws_iam_role_policy_attachment" "lambda_vpc_execution" {
  count      = var.enable_vpc ? 1 : 0
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
  role       = aws_iam_role.lambda_role.name
}

# S3 permissions (conditional)
resource "aws_iam_role_policy" "s3_permissions" {
  count = var.s3_permissions ? 1 : 0
  name  = "${var.function_name}-s3-policy"
  role  = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = concat(
          var.s3_bucket_arns,
          [for arn in var.s3_bucket_arns : "${arn}/*"]
        )
      }
    ]
  })
}

# DynamoDB permissions (conditional)
resource "aws_iam_role_policy" "dynamodb_permissions" {
  count = var.dynamodb_permissions ? 1 : 0
  name  = "${var.function_name}-dynamodb-policy"
  role  = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = concat(
          var.dynamodb_table_arns,
          [for arn in var.dynamodb_table_arns : "${arn}/index/*"]
        )
      }
    ]
  })
}

# SQS permissions (conditional)
resource "aws_iam_role_policy" "sqs_permissions" {
  count = var.sqs_permissions ? 1 : 0
  name  = "${var.function_name}-sqs-policy"
  role  = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = var.sqs_queue_arns
      }
    ]
  })
}

# Lambda permissions (conditional)
resource "aws_iam_role_policy" "lambda_permissions" {
  count = var.lambda_permissions ? 1 : 0
  name  = "${var.function_name}-lambda-policy"
  role  = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = var.lambda_function_arns
      }
    ]
  })
}

# Lambda function
resource "aws_lambda_function" "function" {
  function_name = var.function_name
  role          = aws_iam_role.lambda_role.arn
  handler       = var.handler
  runtime       = var.runtime
  architectures = [var.architecture]
  memory_size   = var.memory_size
  timeout       = var.timeout
  tags          = var.tags
  layers        = var.lambda_layers

  filename         = var.lambda_package_path != null ? var.lambda_package_path : data.archive_file.empty_package[0].output_path
  source_code_hash = var.lambda_package_path != null ? filebase64sha256(var.lambda_package_path) : data.archive_file.empty_package[0].output_base64sha256

  dynamic "environment" {
    for_each = length(var.environment_variables) > 0 ? [1] : []
    content {
      variables = var.environment_variables
    }
  }

  dynamic "vpc_config" {
    for_each = var.enable_vpc ? [1] : []
    content {
      subnet_ids         = var.subnet_ids
      security_group_ids = var.security_group_ids
    }
  }

  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash
    ]
  }
}

resource "aws_iam_role_policy" "additional_policies" {
  for_each = var.additional_iam_policies
  name     = "${var.function_name}-${each.key}"
  role     = aws_iam_role.lambda_role.id
  policy   = each.value
}

# Lambda function URL (conditional)
resource "aws_lambda_function_url" "function_url" {
  count              = var.create_function_url ? 1 : 0
  function_name      = aws_lambda_function.function.function_name
  authorization_type = var.function_url_authorization_type
}
