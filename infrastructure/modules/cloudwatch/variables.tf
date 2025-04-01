variable "aws_region" {
  description = "AWS region where the resources will be created"
  type        = string
}

variable "iot_log_group_name" {
  description = "Name of the CloudWatch log group for IoT Core logs"
  type        = string
  default     = "/aws/iot/core"
}

variable "log_retention_days" {
  description = "Number of days to retain logs in CloudWatch"
  type        = number
  default     = 30
}

variable "cloudwatch_role_name" {
  description = "Name of the IAM role for IoT Core to write logs to CloudWatch"
  type        = string
}

variable "cloudwatch_policy_name" {
  description = "Name of the IAM policy for IoT Core to write logs to CloudWatch"
  type        = string
}

variable "iot_alerts_topic_name" {
  description = "Name of the SNS topic for IoT alerts"
  type        = string
}

variable "connection_success_threshold" {
  description = "Threshold for the minimum number of successful connections per day"
  type        = number
  default     = 10
}
