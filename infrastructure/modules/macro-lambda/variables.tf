variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
}

variable "isolated_subnet_ids" {
  description = "Isolated subnet IDs (no IGW, no NAT) where Lambda functions run"
  type        = list(string)
}

variable "lambda_sg_id" {
  description = "Security group ID for macro-runner Lambda functions (created by the VPC module)"
  type        = string
}

variable "languages" {
  description = "Per-language configuration combining Lambda compute settings and ECR repository info"
  type = map(object({
    memory             = number
    timeout            = number
    ecr_repository_url = string
    ecr_repository_arn = string
  }))
}

variable "flow_log_group_name" {
  description = "CloudWatch log group name for VPC flow logs — used for rejected-traffic metric filter"
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch log retention for Lambda function logs"
  type        = number
  default     = 7
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
