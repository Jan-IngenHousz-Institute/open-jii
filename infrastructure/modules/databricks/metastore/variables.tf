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

variable "delta_sharing_scope" {
  description = "Scope of Delta Sharing on the metastore. INTERNAL_AND_EXTERNAL enables sharing with external recipients."
  type        = string
  default     = "INTERNAL_AND_EXTERNAL"

  validation {
    condition     = contains(["INTERNAL", "INTERNAL_AND_EXTERNAL"], var.delta_sharing_scope)
    error_message = "delta_sharing_scope must be either INTERNAL or INTERNAL_AND_EXTERNAL."
  }
}

variable "delta_sharing_recipient_token_lifetime_in_seconds" {
  description = "Lifetime in seconds for Delta Sharing recipient tokens. 0 means no expiry."
  type        = number
  default     = 0
}

variable "delta_sharing_organization_name" {
  description = "Organization name for Delta Sharing. Used as a human-readable identifier."
  type        = string
  default     = null
}



