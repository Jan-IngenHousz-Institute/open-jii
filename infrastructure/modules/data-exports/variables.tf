variable "environment" {
  description = "Environment name (dev/prod)"
  type        = string
}

variable "bucket_arn" {
  description = "ARN of the bucket that holds experiment data exports"
  type        = string
}
