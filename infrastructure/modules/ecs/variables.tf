variable "cluster_name" {
  description = "ECS Cluster name"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
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
}

variable "memory" {
  description = "Memory for the ECS task"
  type        = string
}

variable "network_mode" {
  description = "Network mode for the ECS task"
  type        = string
}

variable "container_name" {
  description = "Name of the container"
  type        = string
}

variable "image" {
  description = "Docker image for the container"
  type        = string
}

variable "container_port" {
  description = "Container port to expose"
  type        = number
}

variable "host_port" {
  description = "Host port to map to the container"
  type        = number
}

variable "desired_count" {
  description = "Desired count for ECS service"
  type        = number
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
}
