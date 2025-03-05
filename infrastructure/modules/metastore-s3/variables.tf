variable "bucket_name" {
  description = "Name of the S3 bucket for Unity Catalog metastore storage"
  type        = string
}

variable "force_destroy" {
  description = "Boolean that indicates whether the bucket can be destroyed even if it contains objects"
  type        = bool
  default     = false
}

variable "tags" {
  description = "A map of tags to assign to the bucket"
  type        = map(string)
  default     = {}
}

variable "storage_credential_name" {
  description = "Name of the storage credential to create in Unity Catalog"
  type        = string
}

variable "iam_role_name" {
  description = "Name of the IAM role to create for Unity Catalog access"
  type        = string
  default     = "unity-catalog-access-role"
}

variable "aws_account_id" {
  description = "AWS account ID where the role will be created (if not provided, current account will be used)"
  type        = string
  default     = null
}

variable "create_external_location" {
  description = "Whether to create an external location in Unity Catalog"
  type        = bool
  default     = false
}

variable "external_location_name" {
  description = "Name of the external location to create"
  type        = string
  default     = "default-external-location"
}

variable "external_location_path" {
  description = "Path within the S3 bucket for the external location"
  type        = string
  default     = ""
}

variable "external_location_grants" {
  description = "List of permission grants for the external location"
  type = list(object({
    principal  = string
    privileges = list(string)
  }))
  default = []
}
