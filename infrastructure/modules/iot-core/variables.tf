variable "aws_region" {
  description = "Name of the IoT Topic Rule"
  type        = string
  default     = "eu-central-1"
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

