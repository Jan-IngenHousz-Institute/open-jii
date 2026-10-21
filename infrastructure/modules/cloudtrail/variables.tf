variable "project_name" {
  description = "Name of the project (used for resource naming)"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "region" {
  description = "AWS region for resources"
  type        = string
  default     = "eu-central-1"
}


variable "log_retention_days" {
  description = "Days each log file is locked against deletion (S3 Object Lock, GOVERNANCE mode)"
  type        = number
  default     = 365
}

variable "log_archive_after_days" {
  description = "Days before log files move to Glacier Flexible Retrieval"
  type        = number
  default     = 90
}

variable "log_expiration_days" {
  description = "Days before log files, current and noncurrent versions, are deleted. Must exceed log_retention_days."
  type        = number
  default     = 400
}
