output "iot_policy_names" {
  description = "Names of the IoT policies attached to each authenticated Cognito identity (one per channel)"
  value       = [for policy in aws_iot_policy.iot_policy : policy.name]
}


output "iot_topic_rule_names" {
  description = "Names of the IoT Topic Rules"
  value       = [for rule in aws_iot_topic_rule.iot_rules : rule.name]
}

output "device_thing_type_name" {
  description = "Name of the IoT Thing type applied to platform-managed devices"
  value       = aws_iot_thing_type.device.name
}

output "device_thing_group_name" {
  description = "Name of the IoT Thing group that holds all platform-managed devices"
  value       = aws_iot_thing_group.managed_devices.name
}

output "iot_kinesis_role_arn" {
  description = "ARN of the IoT Kinesis IAM Role"
  value       = aws_iam_role.iot_kinesis_role.arn
}

output "backend_s3_presign_policy_arn" {
  description = "ARN of the IAM policy that allows the backend ECS task role to generate pre-signed S3 PutObject URLs for large IoT payloads"
  value       = aws_iam_policy.backend_s3_presign.arn
}

output "databricks_large_iot_read_policy_arn" {
  description = "ARN of the IAM policy granting the Databricks storage-credential role read access to the large-iot bucket"
  value       = aws_iam_policy.databricks_large_iot_read.arn
}

