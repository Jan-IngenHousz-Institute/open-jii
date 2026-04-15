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

variable "private_subnets_ids" {
  description = "List of private subnet IDs for VPC configuration (optional, required if using VPC)."
  type        = list(string)
}

variable "security_group_ids" {
  description = "List of security group IDs for VPC configuration (optional, required if using VPC)."
  type        = list(string)
}

