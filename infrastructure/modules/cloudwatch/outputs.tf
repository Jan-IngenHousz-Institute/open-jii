output "iot_cloudwatch_role_arn" {
  description = "ARN of the IAM role for IoT Core to write to CloudWatch"
  value       = aws_iam_role.iot_cloudwatch_role.arn
}
