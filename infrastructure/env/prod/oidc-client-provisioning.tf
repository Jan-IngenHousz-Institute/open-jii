variable "instrument_tracking_oidc_provisioner_role_arn" {
  description = "Sandbox role ARN supplied by the private foundation's managed GitHub production configuration"
  type        = string
  validation {
    condition     = can(regex("^arn:aws:iam::[0-9]{12}:role/jii-instrument-tracking-prod-oidc-provisioner$", var.instrument_tracking_oidc_provisioner_role_arn))
    error_message = "Use the configured instrument-tracking provisioner role ARN."
  }
}

locals {
  oidc_provisioner_tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "Terraform"
    Component   = "oidc-client-provisioning"
  }
  oidc_provisioner_name = "oidc-client-provisioner-${var.environment}"
  oidc_provisioner_trust = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
      Condition = {
        StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.oidc_provisioner.account_id }
      }
    }]
  })
}

data "aws_caller_identity" "oidc_provisioner" {}

resource "aws_iam_role" "oidc_provisioner_task" {
  name               = "ecs-task-role-${local.oidc_provisioner_name}"
  assume_role_policy = local.oidc_provisioner_trust
  tags               = local.oidc_provisioner_tags
}

resource "aws_iam_role_policy" "oidc_provisioner_bridge" {
  name = "instrument-tracking-secret-bridge"
  role = aws_iam_role.oidc_provisioner_task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "sts:AssumeRole"
      Resource = var.instrument_tracking_oidc_provisioner_role_arn
    }]
  })
}

resource "aws_iam_role" "oidc_provisioner_execution" {
  name               = "${local.oidc_provisioner_name}-execution"
  assume_role_policy = local.oidc_provisioner_trust
  tags               = local.oidc_provisioner_tags
}

resource "aws_iam_role_policy_attachment" "oidc_provisioner_execution" {
  role       = aws_iam_role.oidc_provisioner_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "oidc_provisioner_database" {
  name = "database-credential"
  role = aws_iam_role.oidc_provisioner_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "secretsmanager:GetSecretValue"
      Resource = module.aurora_db.master_user_secret_arn
    }]
  })
}

resource "aws_cloudwatch_log_group" "oidc_provisioner" {
  name              = "/aws/ecs/${local.oidc_provisioner_name}"
  retention_in_days = 30
  tags              = local.oidc_provisioner_tags
}

resource "aws_ecs_task_definition" "oidc_provisioner" {
  tags                     = local.oidc_provisioner_tags
  family                   = local.oidc_provisioner_name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  task_role_arn            = aws_iam_role.oidc_provisioner_task.arn
  execution_role_arn       = aws_iam_role.oidc_provisioner_execution.arn
  container_definitions = jsonencode([{
    name                   = "oidc-client-provisioner"
    image                  = module.backend_ecr.repository_url
    essential              = true
    readonlyRootFilesystem = true
    command = [
      "node", "node_modules/@repo/auth/dist/scripts/reconcile-oauth-client.js",
      "--client", "jii-instrument-tracking-prod"
    ]
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "ENVIRONMENT_PREFIX", value = var.environment },
      { name = "OIDC_SOURCE_ACCOUNT", value = data.aws_caller_identity.oidc_provisioner.account_id },
      { name = "OIDC_TARGET_ROLE_ARN", value = var.instrument_tracking_oidc_provisioner_role_arn },
      { name = "DB_HOST", value = module.aurora_db.cluster_endpoint },
      { name = "DB_NAME", value = module.aurora_db.database_name },
      { name = "DB_PORT", value = tostring(module.aurora_db.cluster_port) }
    ]
    secrets = [{ name = "DB_CREDENTIALS", valueFrom = module.aurora_db.master_user_secret_arn }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.oidc_provisioner.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "provision"
      }
    }
  }])
}

resource "aws_ssm_parameter" "oidc_provisioner" {
  for_each = {
    task-definition-arn = aws_ecs_task_definition.oidc_provisioner.arn
    cluster-name        = module.migration_runner_ecs.ecs_cluster_name
    subnets             = jsonencode(module.vpc.private_subnets)
    security-group-id   = module.vpc.migration_task_security_group_id
    ecr-repository-name = module.backend_ecr.repository_name
  }
  name  = "/oidc-client/${var.environment}/${each.key}"
  type  = "String"
  value = each.value
  tags  = local.oidc_provisioner_tags
}
