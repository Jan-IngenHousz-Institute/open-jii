data "aws_caller_identity" "current" {}

# CloudWatch Logs group for ECS
resource "aws_cloudwatch_log_group" "ecs_logs" {
  name              = "/ecs/${var.service_name}-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = merge(
    {
      Name        = "/ecs/${var.service_name}-${var.environment}"
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
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = "arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.current.account_id}:secret:open_jii_${var.environment}/*"
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

# Task role policy - defines what the running container can do within AWS
# This follows the principle of least privilege - only granting necessary permissions
resource "aws_iam_policy" "ecs_task_policy" {
  name        = "ecs-task-policy-${var.service_name}-${var.environment}"
  description = "Policy for ECS task role - runtime permissions for the application"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        # Allow reading configuration parameters from SSM Parameter Store
        # Useful for non-sensitive config like feature flags, API endpoints, etc.
        Effect = "Allow",
        Action = [
          "ssm:GetParameters",
          "ssm:GetParameter"
        ],
        Resource = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/open_jii_${var.environment}/*"
      },
      {
        # Allow reading secrets from AWS Secrets Manager
        # For sensitive data like database passwords, API keys, etc.
        # Secrets Manager provides automatic rotation and better security than env vars
        Effect = "Allow",
        Action = [
          "secretsmanager:GetSecretValue"
        ],
        Resource = "arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.current.account_id}:secret:open_jii_${var.environment}/*"
      },
      {
        # Allow application to send custom metrics and logs to CloudWatch
        # Resource = "*" is required for CloudWatch metrics and log creation
        # This enables application-level monitoring and observability
        Effect = "Allow",
        Action = [
          "cloudwatch:PutMetricData",
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        Resource = "*"
      }
    ]
  })
}

# Attach the policy to the task role
resource "aws_iam_role_policy_attachment" "ecs_task_policy_attachment" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.ecs_task_policy.arn
}

##### AWS ECS Cluster #####

resource "aws_ecs_cluster" "ecs_cluster" {
  name = "${var.cluster_name}-${var.environment}"

  # Enable Container Insights for enhanced monitoring and troubleshooting
  # Provides CPU, memory, network, and disk utilization metrics at container level
  # Costs ~$1.50 per monitored container instance per month
  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  # Configure ECS Exec (aws ecs execute-command) for debugging
  # Allows secure shell access to running containers for troubleshooting
  # Logs all exec sessions to CloudWatch for security auditing
  configuration {
    execute_command_configuration {
      logging = "OVERRIDE"

      log_configuration {
        cloud_watch_log_group_name = aws_cloudwatch_log_group.ecs_logs.name
      }
    }
  }

  tags = merge(
    {
      Name        = "${var.cluster_name}-${var.environment}"
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
  # base = minimum number of tasks to run on this capacity provider
  # weight = relative proportion of tasks to run on this provider
  default_capacity_provider_strategy {
    capacity_provider = var.use_spot_instances ? "FARGATE_SPOT" : "FARGATE"
    weight            = 1
    base              = 1
  }
}

##### ECS Task Definition #####

resource "aws_ecs_task_definition" "app_task" {
  family                   = "${var.service_name}-${var.environment}"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn
  cpu                      = var.cpu
  memory                   = var.memory
  network_mode             = "awsvpc" # Required for Fargate, provides each task with its own ENI

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
      image     = "${var.image}:${var.image_tag}"
      essential = true

      # Configure logging for centralized monitoring
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${var.service_name}-${var.environment}"
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
        }
      ],

      # Environment variables
      environment = concat([
        {
          name  = "NODE_ENV"
          value = var.environment
        },
        {
          name  = "PORT"
          value = tostring(var.container_port)
        }
      ], var.environment_variables)

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
      healthCheck = {
        command     = ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:${var.container_port}/health || exit 1"]
        interval    = 30 # Check every 30 seconds
        timeout     = 5  # Allow 5 seconds for the check to complete
        retries     = 3  # Mark unhealthy after 3 consecutive failures
        startPeriod = 60 # Grace period after container start before health checks begin
      }
    }
  ])
}

##### ECS Service #####

resource "aws_ecs_service" "app_service" {
  name            = "${var.service_name}-${var.environment}"
  cluster         = aws_ecs_cluster.ecs_cluster.id
  task_definition = aws_ecs_task_definition.app_task.arn
  launch_type     = "FARGATE"
  desired_count   = var.desired_count

  # Rolling deployment configuration for zero-downtime deployments
  # 200% max allows starting new tasks before stopping old ones
  # 100% min ensures service capacity is never reduced during deployment
  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100

  # Time to wait for tasks to pass health checks before considering deployment failed
  # Should account for application startup time + health check intervals
  health_check_grace_period_seconds = 60

  # ECS managed rolling deployments (vs CODE_DEPLOY for blue/green)
  # ECS controller is simpler and sufficient for most use cases
  # CODE_DEPLOY provides more advanced deployment strategies but adds complexity
  deployment_controller {
    type = "ECS" # Use CODE_DEPLOY for blue/green
  }

  # Load balancer configuration
  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = var.service_name
    container_port   = var.container_port
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
    for_each = var.enable_service_discovery ? [1] : []
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
  count = var.enable_autoscaling ? 1 : 0

  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.ecs_cluster.name}/${aws_ecs_service.app_service.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = var.min_capacity
  max_capacity       = var.max_capacity
}

# CPU based autoscaling
resource "aws_appautoscaling_policy" "ecs_cpu_scaling" {
  count = var.enable_autoscaling ? 1 : 0

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
  count = var.enable_autoscaling ? 1 : 0

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
  count = var.enable_service_discovery ? 1 : 0

  name        = "${var.environment}.local"
  description = "Service discovery namespace for ${var.environment}"
  vpc         = var.vpc_id
}

# Service Discovery Service - registers this specific service in the namespace
# Creates A records that resolve to the IP addresses of healthy tasks
# Automatically updates when tasks are started/stopped or become unhealthy
resource "aws_service_discovery_service" "this" {
  count = var.enable_service_discovery ? 1 : 0

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
