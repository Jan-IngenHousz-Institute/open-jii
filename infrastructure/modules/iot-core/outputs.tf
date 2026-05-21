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

output "large_iot_sqs_queue_url" {
  description = "URL of the SQS queue for large-iot/ S3 event notifications (null when enable_large_iot_sqs is false)"
  value       = var.enable_large_iot_sqs ? aws_sqs_queue.large_iot_notifications[0].url : null
}

output "databricks_large_iot_read_policy_arn" {
  description = "ARN of the IAM policy granting the Databricks storage-credential role read access to large-iot/ S3 objects and the SQS queue (null when enable_large_iot_sqs is false)"
  value       = var.enable_large_iot_sqs ? aws_iam_policy.databricks_large_iot_read[0].arn : null
}

