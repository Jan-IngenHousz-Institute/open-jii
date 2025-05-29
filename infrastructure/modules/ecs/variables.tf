variable "cluster_name" {
  description = "ECS Cluster name"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "family" {
  description = "Name of the ECS task family"
  type        = string
}

variable "execution_role_arn" {
  description = "IAM role ARN for ECS task execution"
  type        = string
}

variable "cpu" {
  description = "CPU units for the ECS task"
  type        = string
  default     = "256"
}

variable "memory" {
  description = "Memory for the ECS task"
  type        = string
  default     = "512"
}

variable "network_mode" {
  description = "Network mode for the ECS task"
  type        = string
  default     = "awsvpc"
}

variable "container_name" {
  description = "Name of the container"
  type        = string
  default     = "app"
}

variable "image" {
  description = "Docker image for the container"
  type        = string
  default     = "public.ecr.aws/nginx/nginx:latest"
}

variable "container_port" {
  description = "Container port to expose"
  type        = number
  default     = 3020
}

variable "host_port" {
  description = "Host port to map to the container"
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

variable "assign_public_ip" {
  description = "Assign public IP to the ECS Service"
  type        = bool
  default     = false
}

variable "target_group_arn" {
  description = "ARN of the ALB target group"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where ECS is deployed"
  type        = string
}

variable "service_name" {
  description = "ECS service name"
  type        = string
  default     = "backend-service"
}

variable "region" {
  description = "AWS region for Secrets Manager"
  type        = string
  default     = "us-east-1"
}

variable "account_id" {
  description = "AWS account ID for Secrets Manager ARNs"
  type        = string
}

variable "db_username_arn" {
  description = "ARN of the Secrets Manager secret key for DB username"
  type        = string
}

variable "db_password_arn" {
  description = "ARN of the Secrets Manager secret key for DB password"
  type        = string
}

variable "db_host" {
  description = "Database host name"
  type        = string
  default     = "localhost"
}

variable "db_port" {
  description = "Database port"
  type        = number
  default     = 5432
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "app_db"
}
