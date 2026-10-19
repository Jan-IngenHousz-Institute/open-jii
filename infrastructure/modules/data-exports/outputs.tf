output "databricks_write_policy_arn" {
  description = "Attach to the Unity Catalog storage credential role so Databricks can write export files"
  value       = aws_iam_policy.databricks_write.arn
}

output "backend_read_policy_arn" {
  description = "Attach to the backend ECS task role so it can read manifests and sign export part downloads"
  value       = aws_iam_policy.backend_read.arn
}
