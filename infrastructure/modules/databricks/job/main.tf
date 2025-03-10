terraform {
  required_providers {
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
    }
  }
}

# Find smallest available node type
data "databricks_node_type" "smallest" {
  local_disk = true
}

data "databricks_spark_version" "latest_lts" {
  long_term_support = true
}

# Create orchestration job
resource "databricks_job" "this" {
  name        = var.name
  description = var.description

  # Shared cluster for any non-pipeline tasks
  job_cluster {
    job_cluster_key = "shared_cluster"

    new_cluster {
      num_workers   = 0 # Single node
      spark_version = data.databricks_spark_version.latest_lts.id
      node_type_id  = data.databricks_node_type.smallest.id

      # Configure for single node
      spark_conf = {
        "spark.databricks.cluster.profile" = "singleNode"
        "spark.master"                     = "local[*]"
      }
    }
  }

  # Create all pipeline tasks
  dynamic "task" {
    for_each = var.pipeline_tasks
    content {
      task_key = task.value.name

      # Add dependency if specified
      dynamic "depends_on" {
        for_each = task.value.depends_on != null ? [task.value.depends_on] : []
        content {
          task_key = depends_on.value
        }
      }

      # Run the DLT pipeline
      pipeline_task {
        pipeline_id = task.value.pipeline_id
      }
    }
  }

  # Create notebook tasks
  dynamic "task" {
    for_each = var.notebook_tasks
    content {
      task_key        = task.value.name
      job_cluster_key = "shared_cluster"

      # Add dependency if specified
      dynamic "depends_on" {
        for_each = task.value.depends_on != null ? [task.value.depends_on] : []
        content {
          task_key = depends_on.value
        }
      }

      notebook_task {
        notebook_path   = task.value.notebook_path
        base_parameters = task.value.parameters
      }
    }
  }

  # Add schedule if provided
  dynamic "schedule" {
    for_each = var.schedule != null ? [var.schedule] : []
    content {
      quartz_cron_expression = var.schedule
      timezone_id            = "UTC"
    }
  }
}
