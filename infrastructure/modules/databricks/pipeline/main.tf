terraform {
  required_providers {
    databricks = {
      source                = "databricks/databricks"
      configuration_aliases = [databricks.workspace]
    }
  }
}

# Get smallest available instance type, only when not using serverless
data "databricks_node_type" "smallest" {
  count      = var.serverless ? 0 : 1
  local_disk = true
}

resource "databricks_pipeline" "this" {
  name     = var.name
  target   = var.schema_name
  provider = databricks.workspace

  catalog = var.catalog_name

  # Support for notebook libraries
  dynamic "library" {
    for_each = var.notebook_paths
    content {
      notebook {
        path = library.value
      }
    }
  }

  # Enhanced compute configuration with min/max workers if autoscale enabled
  dynamic "cluster" {
    for_each = var.serverless ? [] : [1]
    content {
      label = "default"

      # Use smallest available instance or specified type
      node_type_id = var.node_type_id != null ? var.node_type_id : data.databricks_node_type.smallest[0].id

      # Support for autoscaling
      dynamic "autoscale" {
        for_each = var.autoscale ? [1] : []
        content {
          min_workers = var.min_workers
          max_workers = var.max_workers
        }
      }

      # Fixed worker count if autoscaling is disabled
      num_workers = var.autoscale ? null : var.num_workers
    }
  }

  # Serverless compute block
  serverless = var.serverless

  # Support continuous or triggered execution
  continuous = var.continuous_mode

  # Apply any additional configuration
  configuration = merge({
    "pipeline.name" : var.name,
    "pipeline.schema" : var.schema_name,
    "pipeline.logLevel" : var.log_level,
    "pipeline.trigger.retry_on_failure" : "false",
  }, var.configuration)

  # Development mode can be toggled
  development = var.development_mode

  # Run as configuration - supports both service principal and user
  dynamic "run_as" {
    for_each = var.run_as != null ? [var.run_as] : []
    content {
      service_principal_name = run_as.value.service_principal_name
      user_name             = run_as.value.user_name
    }
  }

}

# Grant pipeline permissions to principals if provided
resource "databricks_permissions" "pipeline" {
  count       = length(var.permissions)
  provider    = databricks.workspace
  pipeline_id = databricks_pipeline.this.id

  dynamic "access_control" {
    for_each = [var.permissions[count.index]]
    content {
      service_principal_name = access_control.value.principal_application_id
      permission_level       = access_control.value.permission_level
    }
  }
}
