# ============================================================
# Macro Lambda — Isolated Code Execution via Lambda + Firecracker
# ============================================================
#
# Architecture:
#   Each macro execution runs in its own Firecracker microVM (Lambda).
#   Three functions, one per language runtime:
#     - macro-runner-python  (Python 3.12 + numpy/pandas/scipy)
#     - macro-runner-js      (Node.js 24)
#     - macro-runner-r       (R 4.x + jsonlite)
#
#   Backend invokes the appropriate function via AWS SDK:
#     lambda.invoke({ FunctionName: "macro-runner-python-dev", ... })
#
# External dependencies (injected as variables):
#   - ECR repositories (created by the `ecr` module, 3 instances)
#   - VPC flow logs (created by the `vpc-flow-logs` module)
#
# Security Model (defense-in-depth):
#
#   Layer 1: Compute Isolation (Firecracker microVM)
#     - Each invocation runs in its own Firecracker microVM
#     - Own kernel — kernel exploits stay within the throwaway VM
#     - Read-only filesystem except /tmp (512MB, Lambda default)
#     - Timeout + memory limits enforced by Lambda platform
#
#   Layer 2: Network Isolation (VPC)
#     - Lambda functions placed in isolated VPC subnets
#     - No internet gateway, no NAT gateway
#     - Egress only to VPC endpoints (CloudWatch Logs)
#     - Security group created by the VPC module (no inbound, HTTPS egress only)
#     - NACLs enforce hard network boundaries
#
#   Layer 3: IAM Authentication
#     - Only principals with lambda:InvokeFunction can execute
#     - No API keys needed — IAM is the authentication layer
#     - Backend task role gets scoped invoke permissions
#
#   Layer 4: IAM Zero-Trust (execution role)
#     - Lambda role: ONLY CloudWatch Logs write + VPC ENI management
#     - Explicit DENY on all dangerous services (S3, RDS, IAM, etc.)
#
#   Layer 5: Application Sandboxing (defense-in-depth, not primary)
#     - Restricted builtins (Python), VM sandboxes (Node.js)
#     - Per-item timeouts (1s), output size limits
#
#   Layer 6: Observability
#     - VPC Flow Logs on isolated subnets (via vpc-flow-logs module)
#     - Grafana alert rules (errors, throttles, rejected traffic)
#     - Rejected traffic anomaly detection via custom CloudWatch metric
#     - Short log retention (7 days)
#
# Why Lambda over ECS:
#   - Firecracker VM per invocation (vs shared container in ECS)
#   - No SYS_ADMIN capability needed (nsjail is unnecessary)
#   - Pay-per-execution (vs always-on ECS tasks)
#   - Automatic scaling to 1000 concurrent
#   - Simpler infrastructure (no ALB, no ECS cluster, no API key)
#
# ============================================================

locals {
  languages = toset(["python", "js", "r"])

  default_tags = merge(var.tags, {
    Service   = "macro-runner"
    ManagedBy = "Terraform"
  })
}

# ============================================================
# Lambda Execution Role
# ============================================================

resource "aws_iam_role" "lambda" {
  name = "macro-runner-lambda-${var.environment}"

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

# CloudWatch Logs — ship function logs
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

# VPC ENI management — Lambda needs to create/delete ENIs in isolated subnets
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

# ECR pull — Lambda needs to pull container images
resource "aws_iam_role_policy" "lambda_ecr" {
  name = "ecr-pull"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = values(var.ecr_repository_arns)
      },
      {
        Effect   = "Allow"
        Action   = "ecr:GetAuthorizationToken"
        Resource = "*"
      }
    ]
  })
}

# Explicit deny — prevent ANY access to dangerous services.
# Even if the role somehow gains permissions elsewhere,
# these explicit denies override any allows.
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

# ============================================================
# CloudWatch Log Groups (one per function)
# ============================================================

resource "aws_cloudwatch_log_group" "lambda" {
  for_each = local.languages

  name              = "/aws/lambda/macro-runner-${each.key}-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = merge(local.default_tags, {
    Language = each.key
  })
}

# ============================================================
# Lambda Functions
# ============================================================
#
# Bootstrap sequence (first deploy):
#   1. terraform apply → creates ECR repos (via ecr module), IAM, SGs, log groups
#      (Lambda functions will fail — no images yet)
#   2. Build and push images to each ECR repo:
#        cd apps/macro-runner
#        docker build -f functions/python/Dockerfile -t <ecr_url>:latest .
#        docker push <ecr_url>:latest
#      (repeat for javascript and r)
#   3. terraform apply → creates Lambda functions with image URIs
#
# Subsequent deploys:
#   1. Build and push new image
#   2. aws lambda update-function-code \
#        --function-name macro-runner-python-dev \
#        --image-uri <ecr_url>:latest
# ============================================================

resource "aws_lambda_function" "this" {
  for_each = var.lambda_functions

  function_name = "macro-runner-${each.key}-${var.environment}"
  role          = aws_iam_role.lambda.arn
  package_type  = "Image"
  image_uri     = "${var.ecr_repository_urls[each.key]}:latest"

  timeout     = each.value.timeout
  memory_size = each.value.memory

  # Place in isolated subnets: no internet, no NAT, only VPC endpoints
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

  depends_on = [
    aws_iam_role_policy.lambda_logs,
    aws_iam_role_policy.lambda_vpc,
    aws_cloudwatch_log_group.lambda
  ]
}

# No retries — code execution should not be retried automatically.
# If a script fails, the caller should decide whether to retry.
resource "aws_lambda_function_event_invoke_config" "this" {
  for_each = aws_lambda_function.this

  function_name                = each.value.function_name
  maximum_retry_attempts       = 0
  maximum_event_age_in_seconds = 60
}

# ============================================================
# Consumer IAM Policy — allows backend task role to invoke
# ============================================================
# Attach this policy ARN to any role that needs lambda:InvokeFunction
# on the macro-runner functions (e.g., ECS backend task role).

resource "aws_iam_policy" "invoke" {
  name        = "macro-runner-invoke-${var.environment}"
  description = "Allow invoking macro-runner Lambda functions"

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

# ============================================================
# CloudWatch Metric Filter (rejected VPC traffic)
# ============================================================
# Publishes the custom metric to CloudWatch; alerting is handled
# by the Grafana rule group in the dashboard module.

resource "aws_cloudwatch_log_metric_filter" "rejected_traffic" {
  name           = "macro-runner-rejected-traffic-${var.environment}"
  log_group_name = var.flow_log_group_name
  pattern        = "REJECT"

  metric_transformation {
    name      = "MacroRunnerRejectedTraffic"
    namespace = "OpenJII/MacroRunner"
    value     = "1"
  }
}
