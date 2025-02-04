variable "bucket_name" {
  description = "The name of the S3 bucket"
  type        = string
}

variable "enable_versioning" {
  description = "Enable versioning on the bucket"
  type        = bool
  default     = false
}

variable "sse_algorithm" {
  description = "Server-side encryption algorithm (AES256 or aws:kms)"
  type        = string
  default     = "AES256"
}