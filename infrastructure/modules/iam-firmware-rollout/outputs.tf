output "role_arn" {
  description = "ARN of the role the firmware rollout workflow assumes"
  value       = aws_iam_role.firmware_rollout.arn
}
