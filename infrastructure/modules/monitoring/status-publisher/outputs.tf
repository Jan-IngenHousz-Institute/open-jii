output "function_name" {
  description = "Name of the status publisher Lambda, which its error rule watches"
  value       = aws_lambda_function.status_publisher.function_name
}

output "events_topic_arn" {
  description = "ARN of the SNS topic the publisher posts status events to"
  value       = aws_sns_topic.status_events.arn
}

output "events_topic_name" {
  description = "Name of the SNS topic the publisher posts status events to"
  value       = aws_sns_topic.status_events.name
}
