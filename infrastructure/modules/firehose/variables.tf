variable "delivery_stream_name" {
  description = "Name of the Firehose delivery stream"
  type        = string
}

variable "destination_bucket_arn" {
  description = "ARN of the S3 bucket the stream delivers to"
  type        = string
}

variable "s3_prefix" {
  description = "S3 key prefix for delivered objects (supports Firehose !{timestamp:...} expressions)"
  type        = string
}

variable "error_output_prefix" {
  description = "S3 key prefix for records that failed delivery"
  type        = string
}

variable "buffering_size_mb" {
  description = "Buffer size in MB before flushing to S3"
  type        = number
  default     = 128
}

variable "buffering_interval_seconds" {
  description = "Maximum time in seconds before flushing to S3"
  type        = number
  default     = 900
}

variable "role_name" {
  description = "Name for the IAM role Firehose assumes to write to S3"
  type        = string
}

variable "policy_name" {
  description = "Name for the IAM policy attached to the Firehose role"
  type        = string
}

variable "log_retention_days" {
  description = "Retention for the Firehose error log group"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Tags applied to the delivery stream and log group"
  type        = map(string)
  default     = {}
}
