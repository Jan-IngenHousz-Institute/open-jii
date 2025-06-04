variable "task_name" {
  description = "Name for the ECS task that will run migrations"
  type        = string
  default     = "db-migrations"
}

variable "ecr_repository_name" {
  description = "Name for the ECR repository to store migration container images"
  type        = string
  default     = "db-migrations"
}

variable "aws_region" {
  description = "The AWS region where resources will be created"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC where resources will be created"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs where the ECS task will run"
  type        = list(string)
}

variable "db_security_group_id" {
  description = "ID of the security group attached to the Aurora database"
  type        = string
  default     = null
}

variable "db_port" {
  description = "Port number the Aurora database is listening on"
  type        = number
  default     = 5432
}

variable "db_secret_arn" {
  description = "ARN of the Secrets Manager secret containing the database connection string"
  type        = string
}

variable "task_cpu" {
  description = "CPU units for the ECS task (1024 = 1 vCPU)"
  type        = number
  default     = 256
}

variable "task_memory" {
  description = "Memory (in MiB) for the ECS task"
  type        = number
  default     = 512
}

variable "ephemeral_storage" {
  description = "Ephemeral storage (in GiB) for the ECS task"
  type        = number
  default     = 21
}

variable "log_retention_days" {
  description = "Number of days to retain migration logs in CloudWatch"
  type        = number
  default     = 30
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
}

variable "environment_variables" {
  description = "Additional environment variables for the migration container"
  type = list(object({
    name  = string
    value = string
  }))
  default = []
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "create_cluster" {
  description = "Whether to create a new ECS cluster for running migrations"
  type        = bool
  default     = false
}

variable "existing_ecs_cluster_id" {
  description = "ID of an existing ECS cluster to use for running migrations (if not creating a new one)"
  type        = string
  default     = null
}

variable "existing_ecs_cluster_name" {
  description = "Name of an existing ECS cluster to use for running migrations (if not creating a new one)"
  type        = string
  default     = null
}
