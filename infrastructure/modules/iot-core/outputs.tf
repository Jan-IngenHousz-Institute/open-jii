output "iot_policy_names" {
  description = "Names of the IoT policies"
  value       = [for policy in aws_iot_policy.iot_policy : policy.name]
}

output "iot_topic_rule_names" {
  description = "Names of the IoT Topic Rules"
  value       = [for rule in aws_iot_topic_rule.iot_rules : rule.name]
}

output "iot_kinesis_role_arn" {
  description = "ARN of the IoT Kinesis IAM Role"
  value       = aws_iam_role.iot_kinesis_role.arn
}

