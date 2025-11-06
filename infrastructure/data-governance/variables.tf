variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-central-1"
}

variable "databricks_account_id" {
  description = "Databricks Account ID (used as external_id in the assume role policy)"
  type        = string
  sensitive   = true
}

variable "databricks_client_id" {
  description = "The service principal's client ID for Databricks authentication"
  type        = string
  sensitive   = true
}

variable "databricks_client_secret" {
  description = "The service principal's client secret for Databricks authentication"
  type        = string
  sensitive   = true
}

variable "workspaces" {
  description = "Map of workspace configurations for Unity Catalog setup"
  type = map(object({
    workspace_id  = string
    workspace_url = string
    environment   = string
  }))
  default = {}
}

variable "accounts" {
  description = "Map of AWS account configurations for Unity Catalog setup"
  type = map(object({
    account_id  = string
    environment = string
  }))
  default = {}
}