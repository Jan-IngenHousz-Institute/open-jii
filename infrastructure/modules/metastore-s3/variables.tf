variable "bucket_name" {
  description = "Name of the S3 bucket for Unity Catalog metastore storage"
  type        = string
}

variable "cross_account_role_arns" {
  description = "List of cross-account IAM role ARNs that should have access to this bucket"
  type        = list(string)
  default     = []
}

variable "noncurrent_version_retention_days" {
  description = "Days a previous version of a lakehouse object is kept before it expires"
  type        = number
  default     = 30
}
