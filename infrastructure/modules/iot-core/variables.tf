variable "policy_name" {
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

variable "rule_name" {
  description = "Name for the IoT topic rule"
  type        = string
}

variable "topic_filter" {
  description = "MQTT topic filter for the IoT rule (e.g., 'sensors/+/data')"
  type        = string
}

variable "timestream_database" {
  description = "Timestream database name"
  type        = string
}

variable "timestream_table" {
  description = "Timestream table name"
  type        = string
}