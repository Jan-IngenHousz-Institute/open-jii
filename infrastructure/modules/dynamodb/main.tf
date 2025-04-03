resource "aws_dynamodb_table" "lock_table" {
  name         = var.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = var.tags

  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }
}
