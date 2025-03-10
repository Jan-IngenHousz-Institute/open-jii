terraform {
  required_providers {
    databricks = {
      source = "databricks/databricks"
    }
  }
}

# Get smallest available instance type
data "databricks_node_type" "smallest" {
  local_disk = true
}

resource "databricks_pipeline" "this" {
  name   = var.name
  target = var.schema_name

  # Support for notebook libraries
  dynamic "library" {
    for_each = var.notebook_paths
    content {
      notebook {
        path = library.value
      }
    }
  }

  # Minimal compute configuration
  cluster {
    label = "default"

    # Use smallest available instance
    node_type_id = data.databricks_node_type.smallest.id

    # Only one worker, no autoscaling
    num_workers = 1
  }

  # Not streaming - manual execution only
  continuous = false

  # Apply any additional configuration
  configuration = var.configuration

  # Development mode can be toggled
  development = var.development_mode
}
