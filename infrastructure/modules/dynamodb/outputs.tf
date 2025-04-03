output "table_id" {
  description = "The ID of the DynamoDB table"
  value       = aws_dynamodb_table.lock_table.id
}

output "table_arn" {
  description = "The ARN of the DynamoDB table"
  value       = aws_dynamodb_table.lock_table.arn
}

output "table_name" {
  description = "The name of the DynamoDB table"
  value       = aws_dynamodb_table.lock_table.name
}
