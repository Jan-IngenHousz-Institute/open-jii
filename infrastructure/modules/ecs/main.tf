data "aws_caller_identity" "current" {}

# CloudWatch Logs group for ECS
resource "aws_cloudwatch_log_group" "ecs_logs" {
  name              = var.log_group_name != "" ? var.log_group_name : "/ecs/${var.service_name}-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = merge(
    {
      Name        = var.log_group_name != "" ? var.log_group_name : "/ecs/${var.service_name}-${var.environment}"
      Environment = var.environment
    },
    var.tags
  )
}

##### IAM Resources #####

# Execution role - for the ECS service to pull images, create log groups, etc.
resource "aws_iam_role" "ecs_execution_role" {
  name = "${var.service_name}-ecs-execution-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = merge(
    {
      Name        = "${var.service_name}-ecs-execution-role-${var.environment}"
      Environment = var.environment
      Service     = var.service_name
    },
    var.tags
  )
}

resource "aws_iam_role_policy_attachment" "ecs_execution_role_policy" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Additional policy for pulling from ECR and accessing secrets
resource "aws_iam_role_policy" "ecs_execution_additional_policy" {
  name = "additional-access-policy"
  role = aws_iam_role.ecs_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = var.repository_arn
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "kms:Decrypt" # kms:Decrypt is often needed if the secrets are encrypted with a customer-managed KMS key
        ]
        # Grant access to the ARNs of the secrets themselves, not the specific versions or keys.
        # Extract the base ARN using a regular expression.
        Resource = length(var.secrets) > 0 ? distinct([for secret in var.secrets : regex("^arn:aws:secretsmanager:[^:]+:[^:]+:secret:[^:]+", secret.valueFrom)]) : []
      }
    ]
  })
}

# Task role - for the container to interact with AWS services
resource "aws_iam_role" "ecs_task_role" {
  name = "ecs-task-role-${var.service_name}-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = merge(
    {
      Name = "ecs-task-role-${var.service_name}-${var.environment}"
    },
    var.tags
  )
}

##### AWS ECS Cluster #####
resource "aws_ecs_cluster" "ecs_cluster" {
  name = "${var.service_name}-cluster-${var.environment}"

  # Enable Container Insights for enhanced monitoring and troubleshooting
  # Provides CPU, memory, network, and disk utilization metrics at container level
  # Costs ~$1.50 per monitored container instance per month
  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = merge(
    {
      Name        = "${var.service_name}-cluster-${var.environment}"
      Environment = var.environment
    },
    var.tags
  )
}

# Capacity providers define the infrastructure backing the ECS cluster
# FARGATE: Serverless containers, pay-per-use, easier management
# FARGATE_SPOT: Up to 70% cost savings, suitable for fault-tolerant workloads
resource "aws_ecs_cluster_capacity_providers" "cluster_capacity" {
  cluster_name = aws_ecs_cluster.ecs_cluster.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  # Default strategy determines which capacity provider to use by default
  # Mixed capacity configuration:
  # - When enabled, uses both FARGATE and FARGATE_SPOT with configurable weights
  # - FARGATE base ensures some tasks always run on regular Fargate for stability
  # - FARGATE_SPOT used for cost savings on remaining tasks
  dynamic "default_capacity_provider_strategy" {
    for_each = var.enable_mixed_capacity ? [1, 2] : []
    content {
      capacity_provider = default_capacity_provider_strategy.key == 1 ? "FARGATE" : "FARGATE_SPOT"
      weight            = default_capacity_provider_strategy.key == 1 ? ceil((1 - var.fargate_spot_weight) * 100) : floor(var.fargate_spot_weight * 100)
      base              = default_capacity_provider_strategy.key == 1 ? var.fargate_base_count : 0
    }
  }

  # Single capacity provider strategy when mixed capacity is disabled
  dynamic "default_capacity_provider_strategy" {
    for_each = var.enable_mixed_capacity ? [] : [1]
    content {
      capacity_provider = var.use_spot_instances ? "FARGATE_SPOT" : "FARGATE"
      weight            = 1
      base              = 1
    }
  }
}

##### ECS Task Definition #####

resource "aws_ecs_task_definition" "app_task" {
  family                   = "${var.service_name}-${var.environment}"
  requires_compatibilities = ["FARGATE"]

  execution_role_arn = aws_iam_role.ecs_execution_role.arn
  task_role_arn      = aws_iam_role.ecs_task_role.arn

  cpu    = var.cpu
  memory = var.memory

  network_mode = "awsvpc" # Required for Fargate, provides each task with its own ENI

  # Ephemeral storage for temporary files, logs, etc.
  # 21GB is the minimum; increase if your app needs more temporary storage
  # This storage is lost when the task stops (not persistent)
  ephemeral_storage {
    size_in_gib = 21 # Minimum size for Fargate
  }

  # Container definition
  container_definitions = jsonencode([
    {
      name      = "${var.service_name}"
      image     = "${var.repository_url}"
      essential = true

      # Configure logging for centralized monitoring
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs_logs.name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = var.service_name
        }
      }

      # Port mappings - only included if container_port is not null
      # Disable for migration tasks that don't need to expose ports
      portMappings = var.container_port != null ? [
        {
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
        }
      ] : [],

      # Environment variables
      environment = concat([
        {
          name  = "NODE_ENV"
          value = "production"
        }
        ],
        var.container_port != null ? [{
          name  = "PORT"
          value = tostring(var.container_port)
        }] : [],
      var.environment_variables)

      # Secrets from AWS Secrets Manager
      secrets = var.secrets

      # Resource limits at container level (different from task-level limits above)
      # These should be <= task-level CPU/memory to allow room for sidecar containers
      # Task: 512 CPU units, 1024 MB memory; Container: 256 CPU units, 512 MB memory
      cpu    = var.container_cpu
      memory = var.container_memory

      # Container health check - independent of ALB health checks
      # ECS will restart unhealthy containers automatically
      # Uses wget instead of curl to minimize image size (alpine doesn't include curl)
      # Only added if enable_container_healthcheck is true AND container_port is not null
      healthCheck = (var.enable_container_healthcheck && var.container_port != null) ? {
        command     = ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:${var.container_port}${var.health_check_path} || exit 1"]
        interval    = 30 # Check every 30 seconds
        timeout     = 5  # Allow 5 seconds for the check to complete
        retries     = 3  # Mark unhealthy after 3 consecutive failures
        startPeriod = 60 # Grace period after container start before health checks begin
      } : null
    }
  ])
}

##### ECS Service #####
resource "aws_ecs_service" "app_service" {
  count           = var.create_ecs_service ? 1 : 0
  name            = "${var.service_name}-${var.environment}"
  cluster         = aws_ecs_cluster.ecs_cluster.id
  task_definition = aws_ecs_task_definition.app_task.arn
  desired_count   = var.desired_count

  # Use launch_type only when not using capacity provider strategies
  launch_type = length(var.capacity_provider_strategy) > 0 || var.enable_mixed_capacity ? null : "FARGATE"

  lifecycle {
    ignore_changes = [task_definition]
  }

  # Configure mixed capacity provider strategy at service level when enabled
  # This overrides the default_capacity_provider_strategy defined at cluster level
  dynamic "capacity_provider_strategy" {
    for_each = var.enable_mixed_capacity ? [1, 2] : []
    content {
      capacity_provider = capacity_provider_strategy.key == 1 ? "FARGATE" : "FARGATE_SPOT"
      weight            = capacity_provider_strategy.key == 1 ? ceil((1 - var.fargate_spot_weight) * 100) : floor(var.fargate_spot_weight * 100)
      base              = capacity_provider_strategy.key == 1 ? var.fargate_base_count : 0
    }
  }

  # Use custom capacity provider strategy when specified
  dynamic "capacity_provider_strategy" {
    for_each = !var.enable_mixed_capacity && length(var.capacity_provider_strategy) > 0 ? var.capacity_provider_strategy : []
    content {
      capacity_provider = capacity_provider_strategy.value.capacity_provider
      weight            = capacity_provider_strategy.value.weight
      base              = capacity_provider_strategy.value.base
    }
  }

  # Rolling deployment configuration for zero-downtime deployments
  # 200% max allows starting new tasks before stopping old ones
  # 100% min ensures service capacity is never reduced during deployment
  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100

  # Deployment circuit breaker - prevents failed deployments from continuing to attempt
  # to place tasks and optionally rolls back to the last successful deployment
  dynamic "deployment_circuit_breaker" {
    for_each = var.enable_circuit_breaker || var.enable_circuit_breaker_with_rollback ? [1] : []
    content {
      enable   = true
      rollback = var.enable_circuit_breaker_with_rollback
    }
  }

  # Time to wait for tasks to pass health checks before considering deployment failed
  # Should account for application startup time + health check intervals
  # Only needed when a load balancer is attached
  health_check_grace_period_seconds = var.target_group_arn != null ? 60 : null

  # ECS managed rolling deployments (vs CODE_DEPLOY for blue/green)
  # ECS controller is simpler and sufficient for most use cases
  # CODE_DEPLOY provides more advanced deployment strategies but adds complexity
  deployment_controller {
    type = "ECS" # Use CODE_DEPLOY for blue/green
  }

  # Load balancer configuration - only created if target_group_arn and container_port are provided
  dynamic "load_balancer" {
    for_each = (var.target_group_arn != null && var.container_port != null) ? [1] : []
    content {
      target_group_arn = var.target_group_arn
      container_name   = var.service_name
      container_port   = var.container_port
    }
  }

  # Network configuration for security and connectivity
  # assign_public_ip = false: Tasks run in private subnets and access internet via NAT Gateway
  # This prevents direct internet access to containers while allowing outbound connectivity
  network_configuration {
    subnets          = var.subnets
    assign_public_ip = false # Keep backend private for security
    security_groups  = var.security_groups
  }

  # Service Discovery integration for microservices communication
  # Creates DNS records like backend.dev.local for internal service-to-service calls
  # Eliminates need for hardcoded IPs or load balancer endpoints for internal traffic
  dynamic "service_registries" {
    for_each = var.enable_service_discovery && var.create_ecs_service ? [1] : []
    content {
      registry_arn = aws_service_discovery_service.this[0].arn
    }
  }

  # Inherit tags from service to tasks for better cost tracking and management
  # This ensures all running tasks are properly tagged with environment, service, etc.
  propagate_tags = "SERVICE"

  # Add tags for cost allocation
  tags = merge(
    {
      Name        = "${var.service_name}-${var.environment}"
      Environment = var.environment
    },
    var.tags
  )

  depends_on = [aws_ecs_task_definition.app_task]
}

##### Auto-Scaling #####

resource "aws_appautoscaling_target" "ecs_scaling" {
  count = var.enable_autoscaling && var.create_ecs_service ? 1 : 0

  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.ecs_cluster.name}/${aws_ecs_service.app_service[0].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = var.min_capacity
  max_capacity       = var.max_capacity
}

# CPU based autoscaling
resource "aws_appautoscaling_policy" "ecs_cpu_scaling" {
  count = var.enable_autoscaling && var.create_ecs_service ? 1 : 0

  name               = "${var.service_name}-cpu-scaling-${var.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_scaling[0].resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_scaling[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_scaling[0].service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = var.cpu_threshold
    # Cooldown periods prevent thrashing - rapid scale up/down cycles
    # Scale in slowly (5min) to avoid unnecessary terminations during traffic spikes
    # Scale out quickly (1min) to handle sudden load increases promptly
    scale_in_cooldown  = 300 # 5 minutes to scale in
    scale_out_cooldown = 60  # 1 minute to scale out

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

# Memory-based autoscaling as a secondary scaling trigger
# Useful for memory-intensive applications that may not show high CPU usage
# Many Node.js applications are memory-bound rather than CPU-bound
resource "aws_appautoscaling_policy" "ecs_memory_scaling" {
  count = var.enable_autoscaling && var.create_ecs_service ? 1 : 0

  name               = "${var.service_name}-memory-scaling-${var.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_scaling[0].resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_scaling[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_scaling[0].service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 80.0 # Scale up if memory usage exceeds 80%
    scale_in_cooldown  = 300
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
  }
}

##### Service Discovery #####

# Service Discovery Namespace - creates a private DNS zone for service communication
# Example: backend.dev.local, frontend.dev.local, database.dev.local
# Eliminates hardcoded IP addresses and simplifies microservices architecture
resource "aws_service_discovery_private_dns_namespace" "this" {
  count = var.enable_service_discovery && var.create_ecs_service ? 1 : 0

  name        = "${var.environment}.local"
  description = "Service discovery namespace for ${var.environment}"
  vpc         = var.vpc_id
}

# Service Discovery Service - registers this specific service in the namespace
# Creates A records that resolve to the IP addresses of healthy tasks
# Automatically updates when tasks are started/stopped or become unhealthy
resource "aws_service_discovery_service" "this" {
  count = var.enable_service_discovery && var.create_ecs_service ? 1 : 0

  name = var.service_name

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.this[0].id

    dns_records {
      ttl  = 10  # Low TTL for faster failover when tasks change
      type = "A" # A records map names to IPv4 addresses
    }

    # MULTIVALUE returns all healthy IP addresses, allowing client-side load balancing
    # Alternative: WEIGHTED for server-side load balancing with weights
    routing_policy = "MULTIVALUE"
  }

  # Custom health check configuration
  # failure_threshold = 1 means mark unhealthy after 1 failed health check
  # Integrates with ECS task health checks for automatic DNS record updates
  health_check_custom_config {
    failure_threshold = 1
  }
}
