variable "external_location_name" {
  description = "Name of the external location"
  type        = string
}

variable "bucket_name" {
  description = "Name of the S3 bucket for the external location"
  type        = string
}

variable "external_location_path" {
  description = "Path within the S3 bucket for the external location"
  type        = string
  default     = "external"
}

variable "storage_credential_name" {
  description = "Name of the storage credential to use for this external location"
  type        = string
}

variable "environment" {
  description = "Environment name (dev/prod)"
  type        = string
}

variable "comment" {
  description = "Comment for the external location"
  type        = string
  default     = ""
}