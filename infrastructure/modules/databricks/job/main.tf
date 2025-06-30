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

  # Set performance target for serverless compute at the job level
  performance_target = var.use_serverless ? var.serverless_performance_target : null

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

      dynamic "new_cluster" {
        for_each = (!var.use_serverless && task.value.task_type == "notebook" && task.value.compute_type == "new_cluster") ? [1] : []
        content {
          num_workers   = task.value.single_node ? 0 : task.value.num_workers
          spark_version = data.databricks_spark_version.latest_lts.id
          node_type_id  = task.value.node_type_id != null ? task.value.node_type_id : data.databricks_node_type.smallest.id

          # Merge global spark configs with task-specific configs, with task configs taking precedence
          spark_conf = merge(
            # Base configuration for single node if applicable
            task.value.single_node ? {
              "spark.databricks.cluster.profile" = "singleNode"
              "spark.master"                     = "local[*]"
            } : {},
            # Global spark configurations
            var.global_spark_conf,
            # Task-specific spark configurations
            task.value.spark_conf
          )
        }
      }

      # Only set existing_cluster_id if not using serverless and compute_type is existing_cluster
      existing_cluster_id = (!var.use_serverless && task.value.task_type == "notebook" && task.value.compute_type == "existing_cluster") ? task.value.cluster_id : null

      # Handle task type: notebook or pipeline
      dynamic "notebook_task" {
        for_each = task.value.task_type == "notebook" ? [1] : []
        content {
          notebook_path   = task.value.notebook_path
          base_parameters = task.value.parameters
        }
      }

      # Add Spark configurations for serverless tasks
      dynamic "spark_conf" {
        for_each = var.use_serverless ? [1] : []
        content {
          # Merge global spark configs with task-specific configs
          conf = merge(
            var.global_spark_conf,
            task.value.spark_conf
          )
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

      # Add retry configuration
      retry_on_timeout          = var.task_retry_config.retry_on_timeout
      max_retries               = var.task_retry_config.retries
      min_retry_interval_millis = var.task_retry_config.min_retry_interval_millis
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

# Grant job run permissions to principals if provided
resource "databricks_permissions" "job" {
  count    = length(var.permissions)
  provider = databricks.workspace
  job_id   = databricks_job.this.id

  dynamic "access_control" {
    for_each = var.permissions[count.index].principal_can_manage ? [1] : []
    content {
      service_principal_name = var.permissions[count.index].principal_application_id
      permission_level       = "CAN_MANAGE"
    }
  }

  dynamic "access_control" {
    for_each = var.permissions[count.index].principal_can_manage ? [] : [1]
    content {
      service_principal_name = var.permissions[count.index].principal_application_id
      permission_level       = "CAN_VIEW_METADATA"
    }
  }
}
