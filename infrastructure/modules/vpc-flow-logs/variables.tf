variable "name_prefix" {
  description = "Prefix for resource names (e.g., 'macro-runner')"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs to attach flow logs to"
  type        = list(string)
}

variable "retention_in_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}

variable "traffic_type" {
  description = "Type of traffic to capture (ACCEPT, REJECT, ALL)"
  type        = string
  default     = "ALL"

  validation {
    condition     = contains(["ACCEPT", "REJECT", "ALL"], var.traffic_type)
    error_message = "traffic_type must be one of: ACCEPT, REJECT, ALL"
  }
}

variable "max_aggregation_interval" {
  description = "Maximum interval (seconds) for flow log aggregation. 60 or 600."
  type        = number
  default     = 60

  validation {
    condition     = contains([60, 600], var.max_aggregation_interval)
    error_message = "max_aggregation_interval must be 60 or 600"
  }
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
