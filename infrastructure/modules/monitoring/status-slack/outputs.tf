output "function_name" {
  description = "Name of the status Slack Lambda, which its error rule watches"
  value       = aws_lambda_function.status_slack.function_name
}
