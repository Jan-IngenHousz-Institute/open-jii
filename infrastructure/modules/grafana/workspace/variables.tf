variable "environment" {
  description = "The deployment environment (e.g., dev, staging, prod)"
  type        = string
}

variable "workspace_name" {
  type    = string
  default = "open-jii-amg-workspace"
}

variable "project" {
  type    = string
  default = "open-jii"
}

