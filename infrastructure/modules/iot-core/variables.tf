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

variable "enable_large_iot_sqs" {
  description = "Whether to enable SQS-based processing for large IoT payloads"
  type        = bool
  default     = false
}

variable "large_iot_bucket_name" {
  description = "Name of the dedicated S3 bucket for large IoT payloads (required when enable_large_iot_sqs is true)"
  type        = string
  default     = ""
}

variable "large_iot_bucket_arn" {
  description = "ARN of the dedicated S3 bucket for large IoT payloads (required when enable_large_iot_sqs is true)"
  type        = string
  default     = ""
}

variable "device_types" {
  description = "IoT Thing Types to create, keyed by short name (e.g. 'ambyte')"
  type = map(object({
    description           = string
    searchable_attributes = list(string)
  }))
  default = {}
}

variable "device_groups" {
  description = "IoT Thing Groups to create, keyed by short name"
  type = map(object({
    description  = string
    parent_group = optional(string, null)
  }))
  default = {}
}

variable "provisioning_lambda_arn" {
  description = "ARN of the pre-provisioning Lambda. If empty no Lambda permission is created."
  type        = string
}
