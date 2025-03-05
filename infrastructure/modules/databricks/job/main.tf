resource "databricks_job" "this" {
  name = var.job_name

  schedule {
    quartz_cron_expression = var.schedule_quartz_expression
    timezone_id            = "UTC"
  }

  timeout_seconds = var.timeout_seconds

  job_cluster {
    job_cluster_key = "centrum_job_cluster"

    new_cluster {
      num_workers = 0
      spark_version = data.databricks_spark_version.latest.id
      node_type_id = data.databricks_node_type.smallest.id

      custom_tags = {
        "project"     = "open_jii"
        "environment" = "dev"
      }
    }
  }


  task {
    task_key = "transform_task"

    new_cluster {
      num_workers   = 1
      spark_version = data.databricks_spark_version.latest.id
      node_type_id  = data.databricks_node_type.smallest.id
    }

    notebook_task {
      notebook_path = databricks_notebook.this.path
    }
  }

  task {
    task_key = "ingest_task"

    pipeline_task {
      pipeline_id = var.ingest_pipeline_id
    }
  }
}
