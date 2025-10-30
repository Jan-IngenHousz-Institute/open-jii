terraform {
  required_providers {
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
      configuration_aliases = [databricks.workspace]
    }
  }
}

# Create a Delta Sharing recipient
resource "databricks_recipient" "this" {
  provider = databricks.workspace
  name     = var.recipient_name
  comment  = var.comment

  # Authentication strategy - token-based by default
  authentication_type = var.authentication_type

  # Optional sharing code for recipient activation
  sharing_code = var.sharing_code

  # Optional IP access list for additional security
  ip_access_list {
    allowed_ip_addresses = var.allowed_ip_addresses
  }

  # Optional recipient properties for metadata
  dynamic "properties_kvpairs" {
    for_each = var.properties
    content {
      properties = properties_kvpairs.value
    }
  }
}
