variable "aws_region" {
  description = "Name of the IoT Topic Rule"
  type        = string
  default     = "eu-central-1"
}

variable "environment" {
  description = "Deployment environment (e.g., dev, staging, production)"
  type        = string
}

variable "timestream_table" {
  description = "Name of the Timestream table"
  type        = string
}

variable "timestream_database" {
  description = "Name of the Timestream database"
  type        = string
}

variable "iot_timestream_role_name" {
  description = "Name for the IoT Timestream IAM Role"
  type        = string
}

variable "iot_timestream_policy_name" {
  description = "Name for the IoT Timestream IAM Policy"
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
