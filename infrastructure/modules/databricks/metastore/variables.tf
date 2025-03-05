variable "metastore_name" {
  description = "Name of the Unity Catalog metastore"
  type        = string
  default     = "primary"
}

variable "region" {
  description = "AWS region where the metastore will be deployed"
  type        = string
}

variable "owner" {
  description = "Owner of the metastore (user or group name)"
  type        = string
}

variable "workspace_ids" {
  description = "List of Databricks workspace IDs to be enabled with Unity Catalog"
  type        = list(string)
}

variable "force_destroy" {
  description = "Whether to force destroy the metastore on deletion"
  type        = bool
  default     = false
}

variable "bucket_name" {
  description = "Name of the S3 bucket for Unity Catalog metastore storage"
  type        = string
}

variable "storage_credential_id" {
  description = "ID of the storage credential to associate with the metastore"
  type        = string
  default     = null
}

variable "storage_credential_role_arn" {
  description = "ARN of the IAM role for the storage credential"
  type        = string
  default     = null
}

variable "create_default_catalog" {
  description = "Whether to create a default catalog in the metastore"
  type        = bool
  default     = false
}

variable "default_catalog_name" {
  description = "Name of the default catalog to create"
  type        = string
  default     = "main"
}
