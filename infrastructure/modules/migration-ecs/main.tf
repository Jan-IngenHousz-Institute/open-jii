/**
 * # ECS-based Database Migration Module
 * 
 * This module sets up the infrastructure needed to run database migrations securely 
 * from GitHub Actions to an Aurora Serverless v2 database in a private VPC.
 * 
 * It creates:
 * - ECR repository for migration container images
 * - ECS task definition with proper IAM roles and configuration
 * - Security group with access to Aurora database
 * - Integration with Secrets Manager for database credentials
 */

# ECR Repository for migration container images
resource "aws_ecr_repository" "migration_repository" {
  name                 = var.ecr_repository_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
  }

  tags = var.tags
}

# Create ECS cluster if needed
resource "aws_ecs_cluster" "migration_cluster" {
  count = var.create_cluster ? 1 : 0

  name = "${var.task_name}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = var.tags
}

# Use existing cluster or the one we created
locals {
  ecs_cluster_id   = var.existing_ecs_cluster_id != null ? var.existing_ecs_cluster_id : (var.create_cluster ? aws_ecs_cluster.migration_cluster[0].id : null)
  ecs_cluster_name = var.existing_ecs_cluster_name != null ? var.existing_ecs_cluster_name : (var.create_cluster ? aws_ecs_cluster.migration_cluster[0].name : "default")

  # Network configuration for use in RunTask
  run_task_network_config = jsonencode({
    awsvpcConfiguration = {
      subnets        = var.private_subnet_ids
      securityGroups = [aws_security_group.migration_task_sg.id]
      assignPublicIp = "DISABLED"
    }
  })
}

# ECR Lifecycle Policy - Keep last 10 images
resource "aws_ecr_lifecycle_policy" "migration_lifecycle_policy" {
  repository = aws_ecr_repository.migration_repository.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      action = {
        type = "expire"
      }
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
    }]
  })
}

# IAM Role for the ECS Task Execution
resource "aws_iam_role" "task_execution_role" {
  name = "${var.task_name}-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# Attach the Amazon ECS Task Execution Role policy to the execution role
resource "aws_iam_role_policy_attachment" "task_execution_role_policy" {
  role       = aws_iam_role.task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# IAM policy for accessing Secrets Manager
resource "aws_iam_policy" "secrets_access_policy" {
  name        = "${var.task_name}-secrets-policy"
  description = "Allow ECS task to access the database credentials in Secrets Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "kms:Decrypt"
        ]
        Resource = [
          var.db_secret_arn
        ]
      }
    ]
  })
}

# Attach the Secrets Manager access policy to the task execution role
resource "aws_iam_role_policy_attachment" "secrets_policy_attachment" {
  role       = aws_iam_role.task_execution_role.name
  policy_arn = aws_iam_policy.secrets_access_policy.arn
}

# IAM Role for the ECS Task itself
resource "aws_iam_role" "task_role" {
  name = "${var.task_name}-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# CloudWatch Log Group for the migration task
resource "aws_cloudwatch_log_group" "migration_logs" {
  name              = "/ecs/${var.task_name}"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

# Security Group for the ECS Task
resource "aws_security_group" "migration_task_sg" {
  name        = "${var.task_name}-sg"
  description = "Security group for database migration ECS tasks"
  vpc_id      = var.vpc_id

  # Allow all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = var.tags
}

# Update the Aurora security group to allow access from the migration task security group
resource "aws_security_group_rule" "aurora_ingress" {
  count = var.db_security_group_id != null ? 1 : 0

  type                     = "ingress"
  from_port                = var.db_port
  to_port                  = var.db_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.migration_task_sg.id
  security_group_id        = var.db_security_group_id

  description = "Allow access from migration ECS tasks"
}

# ECS Task Definition for running migrations
resource "aws_ecs_task_definition" "migration_task" {
  family                   = var.task_name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.task_execution_role.arn
  task_role_arn            = aws_iam_role.task_role.arn

  container_definitions = jsonencode([
    {
      name      = "migration-container"
      image     = "${aws_ecr_repository.migration_repository.repository_url}:latest"
      essential = true

      # Log configuration
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.migration_logs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "migration"
        }
      }

      # Retrieving database credentials from Secrets Manager
      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = var.db_secret_arn
        }
      ]

      # Environment variables (not sensitive)
      environment = concat([
        {
          name  = "NODE_ENV"
          value = var.environment
        }
      ], var.environment_variables)
    }
  ])

  # Ephemeral storage if needed
  ephemeral_storage {
    size_in_gib = var.ephemeral_storage
  }

  tags = var.tags
}

# The GitHub Actions IAM role and policy are now provided separately via the iam-oidc module
# The required permissions are documented below for reference:
#
# Required permissions for GitHub Actions:
# - ECR:
#   - ecr:GetAuthorizationToken (global)
#   - ecr:BatchCheckLayerAvailability, ecr:CompleteLayerUpload, ecr:InitiateLayerUpload, 
#     ecr:PutImage, ecr:UploadLayerPart (global)
#   - ecr:GetDownloadUrlForLayer, ecr:BatchGetImage on this ECR repository
# - ECS:
#   - ecs:RunTask, ecs:DescribeTasks on the migration task definition
# - IAM:
#   - iam:PassRole for the task execution and task roles
# - Logs:
#   - logs:GetLogEvents on the migration CloudWatch log group
