variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "enable_mixed_capacity" {
  description = "Whether to enable mixed capacity providers (both FARGATE and FARGATE_SPOT) for cost optimization with stability"
  type        = bool
  default     = false
}

variable "fargate_spot_weight" {
  description = "The relative percentage of tasks to place on FARGATE_SPOT when mixed capacity is enabled (0.0-1.0). For example, 0.7 means 70% of tasks use FARGATE_SPOT"
  type        = number
  default     = 0.7

  validation {
    condition     = var.fargate_spot_weight >= 0 && var.fargate_spot_weight <= 1
    error_message = "The fargate_spot_weight must be between 0 and 1 inclusive"
  }
}

variable "fargate_base_count" {
  description = "The minimum number of tasks that should always run on regular FARGATE when mixed capacity is enabled, for stability"
  type        = number
  default     = 1
}

variable "create_ecs_service" {
  description = "Whether to create an ECS service (set to false for migration tasks that don't need a long-running service). When set to false, only the ECS task definition and cluster are created, but no service is deployed. This is useful for tasks that run once and exit, like database migrations."
  type        = bool
}

variable "service_name" {
  description = "ECS service name"
  type        = string
}

variable "cpu" {
  description = "CPU units for the ECS task"
  type        = number
  default     = 256
}

variable "memory" {
  description = "Memory for the ECS task"
  type        = number
  default     = 512
}

variable "container_cpu" {
  description = "The amount of CPU to allocate for the container"
  type        = number
  default     = 256 # 0.25 vCPU
}

variable "container_memory" {
  description = "The amount of memory to allocate for the container"
  type        = number
  default     = 512 # 0.5 GB
}

variable "repository_url" {
  description = "ECR repository URL for the container image"
  type        = string
}

variable "repository_arn" {
  description = "ECR repository ARN to scope permissions"
  type        = string
}

variable "container_port" {
  description = "Container port to expose. Set to null to disable port mappings entirely (for migration tasks or other non-web services)."
  type        = number
  default     = null
}

variable "desired_count" {
  description = "Desired count for ECS service"
  type        = number
  default     = 1
}

variable "security_groups" {
  description = "Security groups for the ECS Service"
  type        = list(string)
}

variable "subnets" {
  description = "Subnets for the ECS Service"
  type        = list(string)
}

variable "target_group_arn" {
  description = "ARN of the ALB target group. If not provided, no load balancer will be attached."
  type        = string
  default     = null
}

variable "vpc_id" {
  description = "VPC ID where ECS is deployed"
  type        = string
}

variable "region" {
  description = "AWS region for resources"
  type        = string
}

variable "ephemeral_storage" {
  description = "Amount of ephemeral storage (in GiB) to allocate for the task"
  type        = number
  default     = 21 # Minimum size
}

# Scaling configuration
variable "enable_autoscaling" {
  description = "Whether to enable autoscaling for the service"
  type        = bool
  default     = true
}

variable "min_capacity" {
  description = "Minimum number of tasks"
  type        = number
  default     = 1
}

variable "max_capacity" {
  description = "Maximum number of tasks"
  type        = number
  default     = 5
}

variable "cpu_threshold" {
  description = "CPU utilization threshold for scaling up"
  type        = number
  default     = 75 # 75%
}

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 30
}

variable "tags" {
  description = "A map of tags to assign to resources"
  type        = map(string)
  default     = {}
}

variable "enable_service_discovery" {
  description = "Whether to enable Service Discovery for ECS service"
  type        = bool
  default     = false
}

variable "use_spot_instances" {
  description = "Whether to use Fargate Spot instances for cost optimization. Recommended for dev/test environments. If true and capacity_provider_strategy is empty, all instances will use FARGATE_SPOT."
  type        = bool
  default     = false
}

variable "capacity_provider_strategy" {
  description = "A list of capacity provider strategies to use for the service. If not provided, will use either all FARGATE or all FARGATE_SPOT based on use_spot_instances variable."
  type = list(object({
    capacity_provider = string
    weight            = number
    base              = optional(number)
  }))
  default = []
}

variable "secrets" {
  description = "List of secrets from AWS Secrets Manager to inject into the container"
  type = list(object({
    name      = string
    valueFrom = string
  }))
  default = []
}

variable "environment_variables" {
  description = "Additional environment variables for the container"
  type = list(object({
    name  = string
    value = string
  }))
  default = []
}

variable "log_group_name" {
  description = "Name of the CloudWatch log group to use"
  type        = string
  default     = ""
}

variable "enable_container_healthcheck" {
  description = "Whether to enable container health checks. Disable for migration tasks that don't have a health endpoint."
  type        = bool
  default     = true
}

variable "health_check_path" {
  description = "The path for container health check endpoint"
  type        = string
  default     = "/health"
}

variable "enable_circuit_breaker" {
  description = "Whether to enable deployment circuit breaker without rollback"
  type        = bool
  default     = false
}

variable "enable_circuit_breaker_with_rollback" {
  description = "Whether to enable deployment circuit breaker with rollback"
  type        = bool
  default     = false
}

variable "additional_task_role_policy_arns" {
  description = "List of additional IAM policy ARNs to attach to the ECS task role"
  type        = list(string)
  default     = []
}

variable "cognito_identity_pool_id" {
  description = "Cognito Identity Pool ID for restricting developer authentication permissions"
  type        = string
  default     = null
}
