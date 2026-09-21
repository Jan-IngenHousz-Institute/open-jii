variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
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

variable "ecr_repository_url" {
  description = "ECR repository URL holding the calibration sandbox image"
  type        = string
}

variable "ecr_repository_arn" {
  description = "ECR repository ARN, scoped into the function's image pull policy"
  type        = string
}

variable "memory" {
  description = "Function memory in MB. The image carries numpy, pandas and scipy."
  type        = number
  default     = 1024
}

variable "timeout" {
  description = "Function timeout in seconds. Must stay above the handler's own script budget."
  type        = number
  default     = 45
}

variable "flow_log_group_name" {
  description = "CloudWatch log group name for VPC flow logs, read by the rejected-traffic metric filter"
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

variable "reserved_concurrent_executions" {
  description = "Max concurrent executions. Set to -1 for unrestricted."
  type        = number
  default     = -1
}
