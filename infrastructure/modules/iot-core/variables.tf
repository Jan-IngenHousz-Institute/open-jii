variable "aws_region" {
  description = "Name of the IoT Topic Rule"
  type        = string
  default     = "eu-central-1"
}

variable "environment" {
  description = "Deployment environment (e.g., dev, staging, production)"
  type        = string
}

variable "kinesis_stream_name" {
  description = "Name of the Kinesis Data Stream"
  type        = string
}

variable "kinesis_stream_arn" {
  description = "ARN of the Kinesis Data Stream"
  type        = string
}

variable "iot_kinesis_role_name" {
  description = "Name for the IoT Kinesis IAM Role"
  type        = string
}

variable "iot_kinesis_policy_name" {
  description = "Name for the IoT Kinesis IAM Policy"
  type        = string
}

variable "default_log_level" {
  description = "Logging level for IoT Core (ERROR, WARN, INFO, DEBUG, or DISABLED)"
  type        = string
  default     = "INFO"
}

variable "cloudwatch_role_arn" {
  description = "ARN of the IAM role for IoT Core logging created by the cloudwatch module"
  type        = string
}

variable "s3_archive_bucket_name" {
  description = "Name of the S3 bucket for raw IoT archive"
  type        = string
}

variable "s3_archive_bucket_arn" {
  description = "ARN of the S3 bucket for raw IoT archive"
  type        = string
}

variable "iot_s3_role_name" {
  description = "Name for the IAM role that allows IoT Core to write to S3"
  type        = string
}

variable "iot_s3_policy_name" {
  description = "Name for the IAM policy that allows IoT Core to write to S3"
  type        = string
}

variable "firehose_delivery_stream_name" {
  description = "Name of the Firehose delivery stream that buffers the raw IoT archive"
  type        = string
}

variable "firehose_delivery_stream_arn" {
  description = "ARN of the Firehose delivery stream that buffers the raw IoT archive"
  type        = string
}

variable "iot_firehose_role_name" {
  description = "Name for the IAM role that allows IoT Core to put records to Firehose"
  type        = string
}

variable "iot_firehose_policy_name" {
  description = "Name for the IAM policy that allows IoT Core to put records to Firehose"
  type        = string
}

variable "large_iot_bucket_arn" {
  description = "ARN of the dedicated S3 bucket for large IoT payloads (>128 KB)"
  type        = string
  default     = ""
}

variable "enable_fleet_indexing" {
  description = "Enable AWS IoT Fleet Indexing with thing-connectivity status (account/region singleton; enable once per account)"
  type        = bool
  default     = false
}

variable "enable_databricks_lifecycle_read" {
  description = "Create the IAM policy granting the Databricks storage-credential role read access to the raw archive's device-lifecycle-events prefix"
  type        = bool
  default     = false
}
