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
  description = <<-EOT
    Enables Delta Sharing on the metastore. `INTERNAL` shares only within the
    account; `INTERNAL_AND_EXTERNAL` additionally permits token-based (open)
    sharing with non-Databricks recipients. Must be set together with
    `delta_sharing_recipient_token_lifetime_in_seconds`. Null leaves sharing
    disabled.
  EOT
  type        = string
  default     = null

  validation {
    condition     = var.delta_sharing_scope == null || contains(["INTERNAL", "INTERNAL_AND_EXTERNAL"], coalesce(var.delta_sharing_scope, "INTERNAL"))
    error_message = "delta_sharing_scope must be INTERNAL or INTERNAL_AND_EXTERNAL."
  }
}

variable "delta_sharing_recipient_token_lifetime_in_seconds" {
  description = "Expiry for recipient access tokens. Required whenever delta_sharing_scope is set. Databricks caps these at one year."
  type        = number
  default     = null
}

variable "delta_sharing_organization_name" {
  description = <<-EOT
    Organization name presented for Databricks-to-Databricks sharing.

    Write-once: the provider cannot unset it, only change it to another valid
    value, and removing it requires tainting the metastore. Since this
    metastore backs every workspace, treat setting this as irreversible and
    pick the value deliberately.
  EOT
  type        = string
  default     = null
}

# variable "storage_credential_role_arn" {
#   description = "ARN of the IAM role for the storage credential"
#   type        = string
# }



