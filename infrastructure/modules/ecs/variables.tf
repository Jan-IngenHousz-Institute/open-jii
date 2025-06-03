variable "cluster_name" {
  description = "ECS Cluster name"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
  default     = "dev"
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

variable "image" {
  description = "Docker image for the container. Use specific tags instead of :latest for production deployments"
  type        = string
}

variable "image_tag" {
  description = "Docker image tag. Use specific tags like Git SHA or semantic version instead of 'latest' for production"
  type        = string
  default     = "latest"
}

variable "container_port" {
  description = "Container port to expose"
  type        = number
  default     = 3020
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
  description = "ARN of the ALB target group"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where ECS is deployed"
  type        = string
}

variable "region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
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
  description = "Whether to use Fargate Spot instances for cost optimization. Recommended for dev/test environments."
  type        = bool
  default     = false
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
