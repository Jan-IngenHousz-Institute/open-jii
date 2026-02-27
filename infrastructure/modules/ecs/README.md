# ECS Module

Creates an ECS Fargate cluster with a task definition and optional long-running service. Supports both long-running services (backend API) and run-once tasks (database migrations).

## What it does

- ECS cluster with Fargate and/or Fargate Spot capacity providers
- Task definition with configurable CPU, memory, secrets, and environment variables
- Optional ECS service with ALB integration and deployment circuit breaker
- Optional auto-scaling based on CPU utilization
- IAM roles for task execution (image pull, secrets access) and task role (app-level permissions)
- CloudWatch log group for container logs
- Optional Cognito identity pool policy for developer authentication
- Mixed capacity strategy (Fargate + Fargate Spot) for cost optimization

## Usage

### Long-running service (backend API)

```hcl
module "backend_ecs" {
  source = "../../modules/ecs"

  region             = var.aws_region
  environment        = var.environment
  create_ecs_service = true
  service_name       = "backend"

  repository_url = module.ecr.repository_url
  repository_arn = module.ecr.repository_arn

  vpc_id          = module.vpc.vpc_id
  subnets         = module.vpc.private_subnets
  security_groups = [module.vpc.ecs_security_group_id]
  container_port  = 3000

  target_group_arn = module.alb.target_group_arn

  cpu    = 512
  memory = 1024

  enable_autoscaling = true
  min_capacity       = 1
  max_capacity       = 3

  secrets = [
    { name = "DB_CREDENTIALS", valueFrom = module.aurora.master_user_secret_arn }
  ]

  environment_variables = [
    { name = "DB_HOST", value = module.aurora.cluster_endpoint }
  ]
}
```

### Run-once task (database migrations)

```hcl
module "migration_runner" {
  source = "../../modules/ecs"

  region             = var.aws_region
  environment        = var.environment
  create_ecs_service = false
  service_name       = "db-migration-runner"

  repository_url = module.migration_ecr.repository_url
  repository_arn = module.migration_ecr.repository_arn

  security_groups = [module.vpc.migration_task_security_group_id]
  subnets         = module.vpc.private_subnets
  vpc_id          = module.vpc.vpc_id

  cpu    = 256
  memory = 512

  enable_autoscaling           = false
  enable_container_healthcheck = false
}
```

## Key Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `service_name` | Name of the ECS service | `string` | — | yes |
| `create_ecs_service` | `true` for long-running services, `false` for run-once tasks | `bool` | — | yes |
| `repository_url` | ECR repository URL | `string` | — | yes |
| `repository_arn` | ECR repository ARN | `string` | — | yes |
| `security_groups` | Security group IDs | `list(string)` | — | yes |
| `subnets` | Subnet IDs | `list(string)` | — | yes |
| `vpc_id` | VPC ID | `string` | — | yes |
| `region` | AWS region | `string` | — | yes |
| `cpu` | Task CPU units (256, 512, 1024, etc.) | `number` | `256` | no |
| `memory` | Task memory in MiB | `number` | `512` | no |
| `container_port` | Container port (null to disable) | `number` | `null` | no |
| `target_group_arn` | ALB target group ARN | `string` | `null` | no |
| `enable_autoscaling` | Enable CPU-based auto-scaling | `bool` | `true` | no |
| `enable_mixed_capacity` | Use both Fargate and Fargate Spot | `bool` | `false` | no |
| `secrets` | Secrets Manager references to inject | `list(object)` | `[]` | no |
| `environment_variables` | Environment variables for the container | `list(object)` | `[]` | no |
| `enable_circuit_breaker` | Enable deployment circuit breaker | `bool` | `false` | no |

## Outputs

| Name | Description |
|------|-------------|
| `ecs_cluster_name` | Name of the ECS cluster |
| `ecs_service_name` | Name of the ECS service (null if `create_ecs_service = false`) |
| `ecs_task_definition_family` | Task definition family name |
| `ecs_task_definition_arn` | Full ARN of the task definition |
| `container_name` | Name of the primary container |
| `ecs_execution_role_arn` | ARN of the execution role |
| `ecs_task_role_arn` | ARN of the task role |
| `cloudwatch_log_group_name` | CloudWatch log group name |
