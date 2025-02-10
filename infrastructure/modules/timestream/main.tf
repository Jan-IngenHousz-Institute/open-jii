resource "aws_timestreamwrite_database" "this" {
  database_name = var.database_name
}

resource "aws_timestreamwrite_table" "this" {
  database_name = aws_timestreamwrite_database.this.database_name
  table_name    = var.table_name

  retention_properties {
    memory_store_retention_period_in_hours  = var.memory_retention_hours
    magnetic_store_retention_period_in_days = var.magnetic_retention_days
  }
}
