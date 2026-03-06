variable "aws_region" {
  description = "AWS region for ECR repositories"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
}

variable "ci_cd_role_arn" {
  description = "IAM role ARN used by CI/CD to push container images to ECR"
  type        = string
}

variable "isolated_subnet_ids" {
  description = "Isolated subnet IDs (no IGW, no NAT) where Lambda functions run"
  type        = list(string)
}

variable "lambda_sg_id" {
  description = "Security group ID for macro-sandbox Lambda functions (created by VPC module)"
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

variable "languages" {
  description = "Per-language Lambda compute configuration (memory in MB, timeout in seconds)"
  type = map(object({
    memory  = number
    timeout = number
  }))
}

variable "log_retention_days" {
  description = "CloudWatch log retention for Lambda function logs (days)"
  type        = number
  default     = 7
}

variable "flow_log_retention_days" {
  description = "CloudWatch log retention for VPC flow logs (days)"
  type        = number
  default     = 14
}

variable "tags" {
  description = "Additional tags applied to all resources"
  type        = map(string)
  default     = {}
}
