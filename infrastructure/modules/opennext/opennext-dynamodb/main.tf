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

    key_schema {
      attribute_name = "path"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "revalidatedAt"
      key_type       = "RANGE"
    }
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
  }
}
