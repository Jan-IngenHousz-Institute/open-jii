locals {
  default_tags = merge(var.tags, {
    Service   = "macro-sandbox"
    ManagedBy = "Terraform"
  })
}

resource "aws_iam_role" "lambda" {
  name = "macro-sandbox-lambda-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.default_tags
}

resource "aws_iam_role_policy" "lambda_logs" {
  name = "cloudwatch-logs"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = [for lg in aws_cloudwatch_log_group.lambda : "${lg.arn}:*"]
    }]
  })
}

resource "aws_iam_role_policy" "lambda_vpc" {
  name = "vpc-access"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ec2:CreateNetworkInterface",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DeleteNetworkInterface",
        "ec2:AssignPrivateIpAddresses",
        "ec2:UnassignPrivateIpAddresses"
      ]
      Resource = "*"
    }]
  })
}

resource "aws_iam_role_policy" "lambda_ecr" {
  name = "ecr-pull"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = [for lang in var.languages : lang.ecr_repository_arn]
      },
      {
        Effect   = "Allow"
        Action   = "ecr:GetAuthorizationToken"
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_deny" {
  name = "explicit-deny-dangerous-services"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "DenyAllDangerousServices"
      Effect = "Deny"
      Action = [
        "s3:*",
        "rds:*",
        "rds-data:*",
        "ssm:*",
        "iam:*",
        "sts:AssumeRole",
        "ecs:*",
        "dynamodb:*",
        "sqs:*",
        "sns:*",
        "kinesis:*",
        "kms:*",
        "secretsmanager:*",
        "events:*",
        "states:*",
        "execute-api:*",
        "es:*",
        "elasticache:*",
        "redshift:*",
        "kafka:*",
        "organizations:*",
        "cloudformation:*",
        "cloudtrail:*",
        "route53:*",
        "elasticloadbalancing:*",
        "autoscaling:*",
        "cloudfront:*",
        "apigateway:*",
        "cognito-idp:*",
        "cognito-identity:*",
        "lambda:*"
      ]
      Resource = "*"
    }]
  })
}

resource "aws_cloudwatch_log_group" "lambda" {
  for_each = var.languages

  name              = "/aws/lambda/macro-sandbox-${each.key}-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = merge(local.default_tags, {
    Language = each.key
  })
}

resource "aws_lambda_function" "this" {
  for_each = var.languages

  function_name = "macro-sandbox-${each.key}-${var.environment}"
  role          = aws_iam_role.lambda.arn
  package_type  = "Image"
  image_uri     = "${each.value.ecr_repository_url}:latest"

  timeout     = each.value.timeout
  memory_size = each.value.memory

  vpc_config {
    subnet_ids         = var.isolated_subnet_ids
    security_group_ids = [var.lambda_sg_id]
  }

  environment {
    variables = {
      ENVIRONMENT = var.environment
    }
  }

  tags = merge(local.default_tags, {
    Language = each.key
    Security = "isolated"
  })

  lifecycle {
    ignore_changes = [image_uri]
  }

  depends_on = [
    aws_iam_role_policy.lambda_logs,
    aws_iam_role_policy.lambda_vpc,
    aws_cloudwatch_log_group.lambda
  ]
}

resource "aws_lambda_function_event_invoke_config" "this" {
  for_each = aws_lambda_function.this

  function_name                = each.value.function_name
  maximum_retry_attempts       = 0
  maximum_event_age_in_seconds = 60
}

resource "aws_iam_policy" "invoke" {
  name        = "macro-sandbox-invoke-${var.environment}"
  description = "Allow invoking macro-sandbox Lambda functions"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "lambda:InvokeFunction"
      Resource = [for fn in aws_lambda_function.this : fn.arn]
    }]
  })

  tags = local.default_tags
}

resource "aws_cloudwatch_log_metric_filter" "rejected_traffic" {
  name           = "macro-sandbox-rejected-traffic-${var.environment}"
  log_group_name = var.flow_log_group_name
  pattern        = "REJECT"

  metric_transformation {
    name      = "MacroSandboxRejectedTraffic"
    namespace = "OpenJII/MacroSandbox"
    value     = "1"
  }
}
