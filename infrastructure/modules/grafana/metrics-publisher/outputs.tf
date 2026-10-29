output "function_name" {
  description = "Name of the metrics publisher Lambda, which its error rule watches"
  value       = aws_lambda_function.metrics_publisher.function_name
}
