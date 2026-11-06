variable "environment" {
  description = "Deployment environment (dev, prod)"
  type        = string
}

variable "events_topic_arn" {
  description = "ARN of the SNS topic the status publisher posts events to"
  type        = string
}

variable "webhook_secret_arn" {
  description = "Secret holding the Slack incoming webhook address as plain text"
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch log retention for the status Slack function's log group"
  type        = number
  default     = 30
}
