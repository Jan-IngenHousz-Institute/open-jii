output "function_name" {
  description = "Name of the health check publisher Lambda, which its error rule watches"
  value       = aws_lambda_function.ingest_healthcheck.function_name
}
