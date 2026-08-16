output "databricks_write_policy_arn" {
  description = "Attach to the Unity Catalog storage credential role so Databricks can write heartbeat files"
  value       = aws_iam_policy.databricks_write.arn
}

output "function_name" {
  description = "Name of the forwarder Lambda"
  value       = aws_lambda_function.metrics_forwarder.function_name
}
