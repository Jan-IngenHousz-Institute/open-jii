output "function_name" {
  description = "Name of the cost publisher Lambda, which its error rule watches"
  value       = aws_lambda_function.cost_publisher.function_name
}
