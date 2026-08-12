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

variable "file_share_bucket_name" {
  description = "Name of the pre-existing S3 bucket exposed to Databricks as the file-share external location"
  type        = string
  default     = "jii-file-share"
}

variable "file_share_grant_principals" {
  description = "Databricks principals (group names, user emails, or service principal application IDs) granted READ_FILES/WRITE_FILES on the file-share external location. Empty by default: grants are managed manually in Databricks"
  type        = list(string)
  default     = []
}

variable "centralized_metastore_bucket_name" {
  description = "Name of the centralized S3 bucket for Unity Catalog metastore storage in data governance account"
  type        = string
  default     = "open-jii-databricks-uc-eu-central-1-metastore"
}
