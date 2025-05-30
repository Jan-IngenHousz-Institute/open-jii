##### AWS ECS Cluster #####

resource "aws_ecs_cluster" "ecs_cluster" {
  name = "${var.cluster_name}-${var.environment}"
}

##### ECS Task Definition #####

resource "aws_ecs_task_definition" "app_task" {
  family                   = var.family
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = var.execution_role_arn
  cpu                      = var.cpu
  memory                   = var.memory
  network_mode             = var.network_mode

  container_definitions = jsonencode([
    {
      name      = var.container_name
      image     = var.image
      essential = true
      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.host_port
        }
      ],
       environment = [
      {
        name  = "PORT"
        value = tostring(var.container_port)
      },
      {
        name  = "NODE_ENV"
        value = var.environment == "Prod" ? "production" : lower(var.environment)
      },
      {
        name  = "DB_HOST"
        value = var.db_host
      },
      {
        name  = "DB_PORT"
        value = tostring(var.db_port)
      },
      {
        name  = "DB_NAME"
        value = var.db_name
      }
    ],
    secrets = [
      {
        name      = "DB_USERNAME"
        valueFrom = var.db_username_arn
      },
      {
        name      = "DB_PASSWORD"
        valueFrom = var.db_password_arn
      }
    ],
    healthCheck = {
      command     = local.healthcheck_cmd
      interval    = 60
      timeout     = 5
      retries     = 3
      startPeriod = 30
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

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = var.container_name
    container_port   = var.container_port
  }

  network_configuration {
    subnets          = var.subnets  # Reference private subnets
    assign_public_ip = false                          # Keep backend private
    security_groups  = var.security_groups       # Reference security group
  }

  depends_on = [aws_ecs_task_definition.app_task]
}

##### Auto-Scaling #####

resource "aws_appautoscaling_target" "ecs_scaling" {
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.ecs_cluster.name}/${aws_ecs_service.app_service.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = 1
  max_capacity       = 5
}

resource "aws_appautoscaling_policy" "ecs_cpu_scale_up" {
  name               = "ecs-scale-up"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_scaling.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_scaling.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_scaling.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 75.0  # Scale up if CPU usage exceeds 75%
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

