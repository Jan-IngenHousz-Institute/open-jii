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
