output "iot_policy_arn" {
  value = aws_iot_policy.iot_policy.arn
}

output "iot_timestream_role_arn" {
  value = aws_iam_role.iot_timestream_role.arn
}