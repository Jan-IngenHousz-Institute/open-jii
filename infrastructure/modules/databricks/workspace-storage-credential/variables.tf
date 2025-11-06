variable "credential_name" {
  description = "Name of the storage credential"
  type        = string
}

variable "role_name" {
  description = "Name of the IAM role for storage access"
  type        = string
}

variable "environment" {
  description = "Environment name (dev/prod)"
  type        = string
}

variable "bucket_name" {
  description = "Name of the centralized metastore S3 bucket"
  type        = string
}

variable "isolation_mode" {
  description = "Isolation mode for the storage credential (ISOLATION_MODE_ISOLATED or ISOLATION_MODE_OPEN)"
  type        = string
  default     = "ISOLATION_MODE_ISOLATED"
}
