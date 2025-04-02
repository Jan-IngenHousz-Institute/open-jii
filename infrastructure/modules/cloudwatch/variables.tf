variable "aws_region" {
  description = "AWS region where the resources will be created"
  type        = string
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
