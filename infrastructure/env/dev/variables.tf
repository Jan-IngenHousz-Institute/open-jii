variable "bucket_name" {
  description = "Docusaurus S3 bucket name"
  type        = string
}

variable "default_root_object" {
  description = "Docusaurus S3 bucket name"
  type        = string
  default     = "index.html"
}

variable "timestream_database_name" {
  description = "Timestream database name"
  type        = string
}

variable "timestream_table_name" {
  description = "Timestream table name"
  type        = string
}

variable "iot_policy_name" {
  description = "Name for the IoT policy"
  type        = string
}

variable "iot_timestream_role_name" {
  description = "Name for the IAM role for IoT to write to Timestream"
  type        = string
}

variable "iot_timestream_policy_name" {
  description = "Name for the IAM policy for IoT to write to Timestream"
  type        = string
}

variable "iot_rule_name" {
  description = "Name for the IoT topic rule"
  type        = string
}

variable "topic_filter" {
  description = "MQTT topic filter (e.g., 'sensors/+/data')"
  type        = string
}

variable "kinesis_stream_name" {
  description = "Name of the Kinesis Data Stream"
  type        = string
}

variable "iot_kinesis_role_name" {
  description = "Name for the IoT Kinesis IAM Role"
  type        = string
}

variable "iot_kinesis_policy_name" {
  description = "Name for the IoT Kinesis IAM Policy"
}

variable "tags" {
  description = "Common tags for resources"
  type        = map(string)
  default     = {}
}

variable "databricks_account_id" {
  description = "Databricks Account ID (used as external_id in the assume role policy)"
  type        = string
}
