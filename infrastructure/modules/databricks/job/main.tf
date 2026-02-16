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

  # Environment configuration for serverless compute dependencies
  dynamic "environment" {
    for_each = var.environments
    content {
      environment_key = environment.value.environment_key
      spec {
        environment_version = environment.value.spec.environment_version
        dependencies        = environment.value.spec.dependencies
      }
    }
  }

  dynamic "continuous" {
    for_each = var.continuous ? [1] : []
    content {
      pause_status = "PAUSED"
    }
  }

  # Queue configuration
  dynamic "queue" {
    for_each = var.queue != null ? [1] : []
    content {
      enabled = var.queue.enabled
    }
  }

  dynamic "task" {
    for_each = var.tasks
    content {
      task_key = task.value.key

      # Reference environment for serverless tasks if specified
      environment_key = var.use_serverless && length(var.environments) > 0 ? var.environments[0].environment_key : null

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
      pause_status           = "UNPAUSED"
      quartz_cron_expression = var.schedule
      timezone_id            = "UTC"
    }
  }

  # Email notifications
  dynamic "email_notifications" {
    for_each = var.email_notifications != null ? [1] : []
    content {
      on_start                               = var.email_notifications.on_start
      on_success                             = var.email_notifications.on_success
      on_failure                             = var.email_notifications.on_failure
      on_duration_warning_threshold_exceeded = var.email_notifications.on_duration_warning_threshold_exceeded
      on_streaming_backlog_exceeded          = var.email_notifications.on_streaming_backlog_exceeded
      no_alert_for_skipped_runs              = var.email_notifications.no_alert_for_skipped_runs
    }
  }

  # Webhook notifications (Slack, etc.)
  dynamic "webhook_notifications" {
    for_each = var.webhook_notifications != null ? [1] : []
    content {
      dynamic "on_start" {
        for_each = var.webhook_notifications.on_start != null ? var.webhook_notifications.on_start : []
        content {
          id = on_start.value
        }
      }

      dynamic "on_success" {
        for_each = var.webhook_notifications.on_success != null ? var.webhook_notifications.on_success : []
        content {
          id = on_success.value
        }
      }

      dynamic "on_failure" {
        for_each = var.webhook_notifications.on_failure != null ? var.webhook_notifications.on_failure : []
        content {
          id = on_failure.value
        }
      }

      dynamic "on_duration_warning_threshold_exceeded" {
        for_each = var.webhook_notifications.on_duration_warning_threshold_exceeded != null ? var.webhook_notifications.on_duration_warning_threshold_exceeded : []
        content {
          id = on_duration_warning_threshold_exceeded.value
        }
      }

      dynamic "on_streaming_backlog_exceeded" {
        for_each = var.webhook_notifications.on_streaming_backlog_exceeded != null ? var.webhook_notifications.on_streaming_backlog_exceeded : []
        content {
          id = on_streaming_backlog_exceeded.value
        }
      }
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
