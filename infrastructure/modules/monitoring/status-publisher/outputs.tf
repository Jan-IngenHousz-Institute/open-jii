output "function_name" {
  description = "Name of the status publisher Lambda, which its error rule watches"
  value       = aws_lambda_function.status_publisher.function_name
}
