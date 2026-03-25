resource "aws_dynamodb_table" "revalidation" {
  name         = var.table_name
  billing_mode = var.billing_mode
  hash_key     = "tag"
  range_key    = "path"

  attribute {
    name = "tag"
    type = "S"
  }

  attribute {
    name = "path"
    type = "S"
  }

  attribute {
    name = "revalidatedAt"
    type = "N"
  }

  global_secondary_index {
    name            = "revalidate"
    projection_type = "ALL"
    hash_key        = "path"
    range_key       = "revalidatedAt"
  }

  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  server_side_encryption {
    enabled = true
  }

  tags = var.tags

  lifecycle {
    prevent_destroy = true
    # Ignore GSI changes to prevent provider schema drift (e.g. warm_throughput)
    # from triggering unnecessary GSI rebuilds on provider upgrades.
    ignore_changes = [global_secondary_index]
  }
}
