variable "environment" {
  description = "The deployment environment (e.g., dev, staging, prod)"
  type        = string
}

variable "workspace_name" {
  description = "Optional name for the Grafana workspace. If omitted, the default is 'open-jii-amg-workspace'."
  type        = string
  default     = "open-jii-amg-workspace"
}

variable "project" {
  description = "Project identifier used for tagging and naming Grafana resources."
  type        = string
  default     = "open-jii"
}
