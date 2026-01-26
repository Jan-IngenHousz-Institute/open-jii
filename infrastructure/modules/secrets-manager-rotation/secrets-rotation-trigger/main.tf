# Data sources
data "aws_caller_identity" "current" {}

resource "aws_cloudwatch_event_rule" "secrets_rotation" {
  name        = "${var.environment}-secrets-manager-rotation-rule"
  description = "Trigger ECS deployment when Secrets Manager rotates Aurora credentials"

  event_pattern = jsonencode({
    source      = ["aws.secretsmanager"]
    detail-type = ["AWS API Call via CloudTrail"]
    detail = {
      eventSource = ["secretsmanager.amazonaws.com"]
      eventName   = ["RotateSecret"]
      requestParameters = {
        secretId = [var.secret_name]
      }
    }
  })

  tags = {
    "Name"        = "Secrets Rotation Trigger Rule"
    "Environment" = var.environment
    "Project"     = "open-jii"
  }
}

resource "aws_cloudwatch_event_target" "ecs_deployment" {
  rule      = aws_cloudwatch_event_rule.secrets_rotation.name
  target_id = "ForceECSDeployment"
  arn       = "arn:aws:ecs:${var.region}:${data.aws_caller_identity.current.account_id}:service/${var.ecs_cluster_name}/${var.ecs_service_name}"
  role_arn  = aws_iam_role.eventbridge_ecs_role.arn

  input = jsonencode({
    cluster            = var.ecs_cluster_name
    service            = var.ecs_service_name
    forceNewDeployment = true
  })

}

# IAM Role for EventBridge
resource "aws_iam_role" "eventbridge_ecs_role" {
  name = "eventbridge-ecs-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "events.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "eventbridge_ecs_policy" {
  name = "eventbridge-ecs-policy-${var.environment}"
  role = aws_iam_role.eventbridge_ecs_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices"
        ]
        Resource = "arn:aws:ecs:${var.region}:${data.aws_caller_identity.current.account_id}:service/${var.ecs_cluster_name}/${var.ecs_service_name}"
      },
      {
        Effect = "Allow"
        Action = [
          "iam:PassRole"
        ]
        Resource = [
          var.ecs_task_execution_role_arn,
          var.ecs_task_role_arn
        ]
      }
    ]
  })
}
