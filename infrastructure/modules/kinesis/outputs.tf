output "kinesis_stream_arn" {
  description = "The ARN of the Kinesis Data Stream"
  value       = aws_kinesis_stream.this.arn
}

output "kinesis_stream_name" {
  description = "The name of the Kinesis Data Stream"
  value       = aws_kinesis_stream.this.name
}
