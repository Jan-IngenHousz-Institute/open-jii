variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-central-1"
}

variable "environment" {
  description = "Environment of the deployment (e.g., 'sandbox')"
  type        = string
  default     = "sandbox"
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

variable "databricks_host" {
  description = "Databricks workspace URL"
  type        = string
  sensitive   = true
}

variable "centralized_metastore_bucket_name" {
  description = "Name of the centralized S3 bucket for Unity Catalog metastore storage in data governance account"
  type        = string
  default     = "open-jii-databricks-uc-eu-central-1-metastore"
}
