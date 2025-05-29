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
      secrets = [
        {
          name      = "DB_USERNAME"
          valueFrom = "arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:myapp/db_credentials:username::"
        },
        {
          name      = "DB_PASSWORD"
          valueFrom = "arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:myapp/db_credentials:password::"
        }
      ]
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

