locals {
  full_name = "open-jii-${var.environment}-${var.function_name}"
}

data "archive_file" "lambda" {
  type        = "zip"
  source_file = "${path.module}/functions/${var.function_name}/handler.js"
  output_path = "${path.module}/functions/${var.function_name}/handler.zip"
}

resource "aws_iam_role" "lambda" {
  name = "open_jii_${var.environment}_${replace(var.function_name, "-", "_")}_lambda_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "basic_execution" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "additional" {
  count = length(var.additional_policy_arns)

  role       = aws_iam_role.lambda.name
  policy_arn = var.additional_policy_arns[count.index]
}

resource "aws_iam_policy" "secrets_access" {
  count = length(var.secret_arns) > 0 ? 1 : 0

  name = "open_jii_${var.environment}_${replace(var.function_name, "-", "_")}_secrets"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "secretsmanager:GetSecretValue"
      Resource = var.secret_arns
    }]
  })
}

resource "aws_iam_role_policy_attachment" "secrets_access" {
  count = length(var.secret_arns) > 0 ? 1 : 0

  role       = aws_iam_role.lambda.name
  policy_arn = aws_iam_policy.secrets_access[0].arn
}


resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.full_name}"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "this" {
  function_name    = local.full_name
  role             = aws_iam_role.lambda.arn
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256
  handler          = var.handler
  runtime          = var.runtime
  timeout          = var.timeout
  memory_size      = var.memory_size

  layers = length(var.layers) > 0 ? var.layers : null

  dynamic "environment" {
    for_each = length(var.environment_variables) > 0 ? [1] : []
    content {
      variables = var.environment_variables
    }
  }

  depends_on = [aws_cloudwatch_log_group.lambda]
}
