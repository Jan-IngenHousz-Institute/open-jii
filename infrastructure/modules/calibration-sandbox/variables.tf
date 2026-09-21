variable "aws_region" {
  description = "AWS region for the ECR repository"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
}

variable "ci_cd_role_arn" {
  description = "IAM role ARN used by CI/CD to push the container image to ECR"
  type        = string
}

variable "isolated_subnet_ids" {
  description = "Isolated subnet IDs (no IGW, no NAT) where the Lambda function runs"
  type        = list(string)
}

variable "lambda_sg_id" {
  description = "Security group ID for the calibration-sandbox Lambda (created by the VPC module)"
  type        = string
}

variable "image_tag_mutability" {
  description = "ECR image tag mutability. Use MUTABLE for dev (overwrite :latest), IMMUTABLE for prod."
  type        = string
  default     = "IMMUTABLE"

  validation {
    condition     = contains(["MUTABLE", "IMMUTABLE"], var.image_tag_mutability)
    error_message = "image_tag_mutability must be MUTABLE or IMMUTABLE."
  }
}

variable "force_delete" {
  description = "Allow ECR repository deletion even when images exist. true for dev, false for prod."
  type        = bool
  default     = false
}

variable "memory" {
  description = "Lambda memory in MB"
  type        = number
  default     = 1024
}

variable "timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 45
}

variable "log_retention_days" {
  description = "CloudWatch log retention for Lambda function logs (days)"
  type        = number
  default     = 7
}

variable "flow_log_group_name" {
  description = "Flow log group of the isolated subnets, owned by the macro sandbox that shares them; the rejected-traffic metric reads it"
  type        = string
}

variable "tags" {
  description = "Additional tags applied to all resources"
  type        = map(string)
  default     = {}
}

variable "reserved_concurrent_executions" {
  description = "Max concurrent executions. Set to -1 for unrestricted."
  type        = number
  default     = -1
}
