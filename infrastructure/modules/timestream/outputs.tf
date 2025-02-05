output "timestream_database_arn" {
  value = aws_timestreamwrite_database.this.arn
}

output "timestream_table_arn" {
  value = aws_timestreamwrite_table.this.arn
}