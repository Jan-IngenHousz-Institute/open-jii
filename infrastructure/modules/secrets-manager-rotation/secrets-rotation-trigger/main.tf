# Data sources
data "aws_caller_identity" "current" {}

resource "aws_cloudwatch_event_rule" "secrets_rotation" {
  name        = "${var.environment}-secrets-manager-rotation-rule"
  description = "Trigger ECS deployment when Secrets Manager rotation succeeds for the specified secret"

  event_pattern = jsonencode({
    source      = ["aws.secretsmanager"]
    region      = [var.region]
    detail-type = ["AWS Service Event via CloudTrail"]
    detail = {
      eventSource = ["secretsmanager.amazonaws.com"]
      eventName   = ["RotationSucceeded"]
      additionalEventData = {
        SecretId = [var.secret_arn]
      }
    }
  })

  tags = {
    Name        = "Secrets Rotation Trigger Rule"
    Environment = var.environment
    Project     = "open-jii"
  }
}

# Create Lambda function code
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/force_deploy.py"
  output_path = "${path.module}/force_deploy.zip"
}

# Lambda Function
resource "aws_lambda_function" "ecs_force_deployment" {
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  function_name    = "${var.environment}-ecs-force-deployment"
  role             = aws_iam_role.lambda_role.arn
  handler          = "force_deploy.handler"
  runtime          = "python3.11"
  timeout          = 60

  environment {
    variables = {
      ECS_CLUSTER_NAME = var.ecs_cluster_name
      ECS_SERVICE_NAME = var.ecs_service_name
    }
  }
}

resource "aws_cloudwatch_event_target" "lambda_target" {
  rule      = aws_cloudwatch_event_rule.secrets_rotation.name
  target_id = "SecretsRotationLambda"
  arn       = aws_lambda_function.ecs_force_deployment.arn
}


resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ecs_force_deployment.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.secrets_rotation.arn
}

resource "aws_iam_role" "lambda_role" {
  name = "secrets-rotation-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "lambda_ecs_policy" {
  name = "lambda-ecs-policy"
  role = aws_iam_role.lambda_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices",
          "ecs:DescribeTasks"
        ]
        Resource = "arn:aws:ecs:${var.region}:${data.aws_caller_identity.current.account_id}:service/${var.ecs_cluster_name}/${var.ecs_service_name}"
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_logs_policy" {
  name = "lambda-logs-policy"
  role = aws_iam_role.lambda_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.environment}-ecs-force-deployment:*"
      }
    ]
  })
}
