variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "environment" {
  description = "The deployment environment (e.g., dev, prod)"
  type        = string
}

variable "project" {
  type    = string
  default = "open-jii"
}

variable "db_host" {
  description = "Aurora cluster writer endpoint hostname"
  type        = string
}

variable "db_port" {
  description = "Aurora cluster port"
  type        = number
  default     = 5432
}

variable "db_name" {
  description = "Database name"
  type        = string
}

variable "aurora_cluster_resource_id" {
  description = "Aurora cluster resource ID (used in IAM policy for rds-db:connect)"
  type        = string
}

variable "private_subnets" {
  description = "Private subnet IDs for the Lambda VPC config"
  type        = list(string)
}

variable "metrics_publisher_lambda_sg_id" {
  description = "Security group ID for the metrics-publisher Lambda"
  type        = string
}
