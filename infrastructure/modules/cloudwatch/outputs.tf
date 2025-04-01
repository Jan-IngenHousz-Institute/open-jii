
output "iot_cloudwatch_role_arn" {
  description = "ARN of the IAM role for IoT Core to write to CloudWatch"
  value       = aws_iam_role.iot_cloudwatch_role.arn
}

output "iot_alerts_topic_arn" {
  description = "ARN of the SNS topic for IoT alerts"
  value       = aws_sns_topic.iot_alerts.arn
}
