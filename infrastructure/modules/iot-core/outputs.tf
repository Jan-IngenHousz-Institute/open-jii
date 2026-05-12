output "iot_topic_rule_names" {
  description = "Names of the IoT Topic Rules"
  value       = [for rule in aws_iot_topic_rule.iot_rules : rule.name]
}

output "iot_kinesis_role_arn" {
  description = "ARN of the IoT Kinesis IAM Role"
  value       = aws_iam_role.iot_kinesis_role.arn
}

output "backend_s3_presign_policy_arn" {
  description = "ARN of the IAM policy that allows the backend ECS task role to generate pre-signed S3 PutObject URLs for large IoT payloads"
  value       = aws_iam_policy.backend_s3_presign.arn
}

