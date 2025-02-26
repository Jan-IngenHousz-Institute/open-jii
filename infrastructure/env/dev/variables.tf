variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-central-1"
}

variable "terraform_state_s3_bucket_name" {
  description = "Terraform state S3 Bucket name"
  type        = string
}

variable "docusaurus_s3_bucket_name" {
  description = "Docusaurus S3 Bucket name"
  type        = string
}

variable "timestream_database_name" {
  description = "Timestream database name"
  type        = string
}

variable "timestream_table_name" {
  description = "Timestream table name"
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

variable "databricks_account_id" {
  description = "Databricks Account ID (used as external_id in the assume role policy)"
  type        = string
  sensitive   = true
}

variable "databricks_client_id" {
  description = "The service principal's client ID for Databricks authentication"
  type        = string
  sensitive   = true
}

variable "databricks_client_secret" {
  description = "The service principal's client secret for Databricks authentication"
  type        = string
  sensitive   = true
}

variable "databricks_bucket_name" {
  description = "Root Databricks configuration S3 Bucket name"
  type        = string
}
