variable "environment" {
  description = "Deployment environment (dev, prod)"
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch log retention for the cost publisher's log group"
  type        = number
  default     = 30
}
