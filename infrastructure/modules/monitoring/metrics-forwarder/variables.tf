variable "environment" {
  description = "Deployment environment (dev, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region for the Lambda log group"
  type        = string
}

variable "heartbeat_bucket_id" {
  description = "Bucket holding heartbeat metric files; this module owns its notification configuration"
  type        = string
}

variable "heartbeat_bucket_arn" {
  description = "ARN of the heartbeat bucket"
  type        = string
}

variable "heartbeat_prefix" {
  description = "Key prefix the Databricks heartbeat job writes under"
  type        = string
  default     = "heartbeat/"
}
