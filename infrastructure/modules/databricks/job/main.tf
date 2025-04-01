terraform {
  required_providers {
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
      configuration_aliases = [databricks.workspace]
    }
  }
}

# Find smallest available node type
data "databricks_node_type" "smallest" {
  local_disk = true
  provider   = databricks.workspace
}

# Find latest Spark version
data "databricks_spark_version" "latest_lts" {
  long_term_support = true
  provider          = databricks.workspace
}

resource "databricks_job" "this" {
  name                = var.name
  description         = var.description
  provider            = databricks.workspace
  max_concurrent_runs = var.max_concurrent_runs

  dynamic "continuous" {
    for_each = var.continuous ? [1] : []
    content {
      pause_status = "PAUSED"
    }
  }

  lifecycle {
    ignore_changes = [
      task,
    ]
  }


  dynamic "task" {
    for_each = var.tasks
    content {
      task_key = task.value.key

      # Only add cluster configuration for notebook tasks
      dynamic "new_cluster" {
        for_each = task.value.task_type == "notebook" && task.value.compute_type == "new_cluster" ? [1] : []
        content {
          num_workers   = task.value.single_node ? 0 : task.value.num_workers
          spark_version = data.databricks_spark_version.latest_lts.id
          node_type_id  = task.value.node_type_id != null ? task.value.node_type_id : data.databricks_node_type.smallest.id

          spark_conf = task.value.single_node ? {
            "spark.databricks.cluster.profile" = "singleNode"
            "spark.master"                     = "local[*]"
          } : {}
        }
      }

      # Only set existing_cluster_id for notebook tasks
      existing_cluster_id = task.value.task_type == "notebook" && task.value.compute_type == "existing_cluster" ? task.value.cluster_id : null

      # Handle task type: notebook or pipeline
      dynamic "notebook_task" {
        for_each = task.value.task_type == "notebook" ? [1] : []
        content {
          notebook_path   = task.value.notebook_path
          base_parameters = task.value.parameters
        }
      }

      dynamic "pipeline_task" {
        for_each = task.value.task_type == "pipeline" ? [1] : []
        content {
          pipeline_id = task.value.pipeline_id
        }
      }

      # Add dependencies
      dynamic "depends_on" {
        for_each = task.value.depends_on != null ? [1] : []
        content {
          task_key = task.value.depends_on
        }
      }
    }
  }

  # Schedule if provided
  dynamic "schedule" {
    for_each = var.schedule != null ? [1] : []
    content {
      quartz_cron_expression = var.schedule
      timezone_id            = "UTC"
    }
  }
}
