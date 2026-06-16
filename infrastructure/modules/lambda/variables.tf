variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "function_name" {
  description = "Short name of the Lambda function — prefixed to open-jii-{env}-{function_name}"
  type        = string
}

variable "handler" {
  description = "Lambda handler (e.g. 'handler.handler')"
  type        = string
  default     = "handler.handler"
}

variable "runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "nodejs22.x"
}

variable "timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 30
}

variable "memory_size" {
  description = "Lambda memory in MB"
  type        = number
  default     = 128
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "environment_variables" {
  description = "Environment variables to pass to the Lambda"
  type        = map(string)
  default     = {}
}

variable "additional_policy_arns" {
  description = "Additional IAM policy ARNs to attach to the Lambda execution role"
  type        = list(string)
  default     = []
}

variable "layers" {
  description = "List of Lambda layer ARNs to attach"
  type        = list(string)
  default     = []
}

