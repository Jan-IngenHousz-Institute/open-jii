output "iot_topic_rule_name" {
  description = "Name of the IoT Topic Rule"
  value       = aws_iot_topic_rule.iot_rule.name
}

output "iot_timestream_role_arn" {
  description = "ARN of the IoT Timestream IAM Role"
  value       = aws_iam_role.iot_timestream_role.arn
}

output "iot_kinesis_role_arn" {
  description = "ARN of the IoT Kinesis IAM Role"
  value       = aws_iam_role.iot_kinesis_role.arn
}
