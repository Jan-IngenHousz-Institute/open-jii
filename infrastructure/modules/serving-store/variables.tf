variable "environment" {
  description = "Deployment environment (dev or prod)"
  type        = string
}

variable "subnet_id" {
  description = "Private subnet for the store's instance and data volume"
  type        = string
}

variable "security_group_id" {
  description = "Security group that admits the store's callers"
  type        = string
}

variable "http_port" {
  description = "Port the store answers HTTP on"
  type        = number
  default     = 80
}

variable "host_number" {
  description = "Host number within the subnet, fixing the store's private address across instance replacements"
  type        = number
  default     = 200
}

variable "instance_type" {
  description = "EC2 instance type (Graviton)"
  type        = string
}

variable "data_volume_size_gb" {
  description = "Size of the data volume in GB"
  type        = number
}

variable "clickhouse_version" {
  description = "ClickHouse release installed from the official package repository"
  type        = string
  default     = "25.8.33.6"
}

variable "metrics_namespace" {
  description = "CloudWatch namespace for the store's health metrics"
  type        = string
  default     = "OpenJII/ServingStore"
}

variable "system_log_retention_days" {
  description = "Days ClickHouse keeps its own system logs (queries, parts, metrics)"
  type        = number
  default     = 30
}

variable "log_retention_days" {
  description = "Retention of the store's CloudWatch logs"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Tags applied to every resource"
  type        = map(string)
  default     = {}
}
