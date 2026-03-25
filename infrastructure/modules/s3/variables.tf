variable "bucket_name" {
  description = "The name of the S3 bucket to create"
  type        = string
}

variable "enable_versioning" {
  description = "Enable versioning on the S3 bucket"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "cloudfront_distribution_arn" {
  description = "Optional: The ARN of a CloudFront distribution that should have access to this bucket"
  type        = string
  default     = null
}

variable "create_cloudfront_policy" {
  description = "Set to true when cloudfront_distribution_arn is provided. Kept as a separate bool so the count meta-argument has a value known at plan time, avoiding the 'count depends on computed values' error."
  type        = bool
  default     = false
}

variable "custom_policy_json" {
  description = "Optional: A custom bucket policy JSON document to apply to the bucket"
  type        = string
  default     = null
}

variable "enable_crr" {
  description = "Enable Cross-Region Replication to a DR region bucket"
  type        = bool
  default     = false
}

variable "dr_bucket_name" {
  description = "Name of the destination bucket in the DR region (defaults to <bucket_name>-dr)"
  type        = string
  default     = null
}

