variable "environment" {
  description = "Deployment environment (dev, prod)"
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch log retention for the health check publisher's log group"
  type        = number
  default     = 7
}

variable "publishing_enabled" {
  description = "Whether the schedule publishes; enable only once the centrum pipeline drops health checks from raw_data"
  type        = bool
  default     = false
}
