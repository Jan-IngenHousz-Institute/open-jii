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
  count      = var.use_serverless ? 0 : 1
  local_disk = true
  provider   = databricks.workspace
}

# Find latest Spark version
data "databricks_spark_version" "latest_lts" {
  count             = var.use_serverless ? 0 : 1
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

  # Run as configuration
  dynamic "run_as" {
    for_each = var.run_as != null ? [1] : []
    content {
      service_principal_name = var.run_as.service_principal_name
      user_name              = var.run_as.user_name
    }
  }

  dynamic "continuous" {
    for_each = var.continuous ? [1] : []
    content {
      pause_status = "PAUSED"
    }
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
            var.spark_conf,
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
      retry_on_timeout          = var.continuous ? false : var.task_retry_config.retry_on_timeout
      max_retries               = var.continuous ? 0 : var.task_retry_config.retries
      min_retry_interval_millis = var.continuous ? 0 : var.task_retry_config.min_retry_interval_millis
    }
  }

  # Schedule if provided
  dynamic "schedule" {
    for_each = var.schedule != null ? [1] : []
    content {
      pause_status = "UNPAUSED"
      quartz_cron_expression = var.schedule
      timezone_id            = "UTC"
    }
  }
}

# Grant job permissions to principals if provided
resource "databricks_permissions" "job" {
  count    = length(var.permissions)
  provider = databricks.workspace
  job_id   = databricks_job.this.id

  dynamic "access_control" {
    for_each = [var.permissions[count.index]]
    content {
      service_principal_name = access_control.value.principal_application_id
      permission_level       = access_control.value.permission_level
    }
  }
}
