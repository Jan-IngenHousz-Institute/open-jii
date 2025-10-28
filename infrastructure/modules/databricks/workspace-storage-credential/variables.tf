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

