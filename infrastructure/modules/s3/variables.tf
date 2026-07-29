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

variable "elb_log_delivery_prefixes" {
  description = "Optional: S3 key prefixes (one per ELB) to grant the ELB log-delivery service write access under. Empty list skips the policy."
  type        = list(string)
  default     = []
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

variable "lifecycle_rules" {
  description = "List of lifecycle rules for the primary bucket"
  type = list(object({
    id     = string
    status = string
    transitions = list(object({
      days          = number
      storage_class = string
    }))
    expiration_days = optional(number)
  }))
  default = []
}

