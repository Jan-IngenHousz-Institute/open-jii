locals {
  default_tags = merge(var.tags, {
    Service   = "calibration-sandbox"
    ManagedBy = "Terraform"
  })

  function_name = "calibration-sandbox-${var.environment}"
}

resource "aws_iam_role" "lambda" {
  name = "calibration-sandbox-lambda-${var.environment}"

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
      Resource = ["${aws_cloudwatch_log_group.lambda.arn}:*"]
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
        "ec2:DescribeSubnets",
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
        Resource = [var.ecr_repository_arn]
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
    Statement = [
      {
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
          "lambda:*",
          "ec2:RunInstances",
          "ec2:TerminateInstances",
          "ec2:ModifyInstanceAttribute"
        ]
        Resource = "*"
      },
      {
        # Without scoping Resource to KMS, NotAction = ["kms:Decrypt"]
        # denies every non-Decrypt action on every resource, including
        # logs:PutLogEvents from the Lambda's own log forwarding, which
        # silently swallows function stdout/stderr.
        Sid       = "DenyAllKMSExceptDecrypt"
        Effect    = "Deny"
        NotAction = ["kms:Decrypt"]
        Resource  = "arn:aws:kms:*:*:*"
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = var.log_retention_days

  tags = local.default_tags
}

resource "aws_lambda_function" "this" {
  function_name = local.function_name
  role          = aws_iam_role.lambda.arn
  package_type  = "Image"
  image_uri     = "${var.ecr_repository_url}:latest"

  timeout     = var.timeout
  memory_size = var.memory

  reserved_concurrent_executions = var.reserved_concurrent_executions

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
    Security = "isolated"
  })

  # image_uri is set to :latest for initial creation; CI/CD updates it
  # via `aws lambda update-function-code` in deploy-calibration-sandbox.yml
  lifecycle {
    ignore_changes = [image_uri]
  }

  depends_on = [
    aws_iam_role_policy.lambda_logs,
    aws_iam_role_policy.lambda_vpc,
    aws_iam_role_policy.lambda_ecr,
    aws_cloudwatch_log_group.lambda
  ]
}

# A calibration run is requested by a person standing at the bench and is recorded
# against one device, so a retried invoke would write a second run for one request.
resource "aws_lambda_function_event_invoke_config" "this" {
  function_name                = aws_lambda_function.this.function_name
  maximum_retry_attempts       = 0
  maximum_event_age_in_seconds = 60
}

resource "aws_iam_policy" "invoke" {
  name        = "calibration-sandbox-invoke-${var.environment}"
  description = "Allow invoking the calibration-sandbox Lambda function"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "lambda:InvokeFunction"
      Resource = [aws_lambda_function.this.arn]
    }]
  })

  tags = local.default_tags
}

resource "aws_cloudwatch_log_metric_filter" "rejected_traffic" {
  name           = "calibration-sandbox-rejected-traffic-${var.environment}"
  log_group_name = var.flow_log_group_name
  pattern        = "REJECT"

  metric_transformation {
    name      = "CalibrationSandboxRejectedTraffic-${var.environment}"
    namespace = "OpenJII/CalibrationSandbox"
    value     = "1"
  }
}
