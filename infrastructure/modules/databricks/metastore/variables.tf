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

# variable "storage_credential_role_arn" {
#   description = "ARN of the IAM role for the storage credential"
#   type        = string
# }



