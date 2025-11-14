terraform {
  required_providers {
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
      configuration_aliases = [databricks.workspace]
    }
  }
}

resource "databricks_notification_destination" "slack" {
  provider     = databricks.workspace
  display_name = var.display_name

  config {
    slack {
      url = var.slack_webhook_url
    }
  }
}