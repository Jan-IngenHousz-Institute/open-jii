terraform {
  required_providers {
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
      configuration_aliases = [databricks.workspace]
    }
  }
}

data "databricks_node_type" "smallest" {
  local_disk = true
}

data "databricks_spark_version" "latest_lts" {
  provider          = databricks.workspace
  long_term_support = true
}

# Upload notebooks to Databricks workspace
resource "databricks_notebook" "ingest_pipeline" {
  provider = databricks.workspace
  path     = "/Shared/notebooks/ingest_pipeline"
  language = "PYTHON"
  source   = "${path.module}/../notebooks/ingest_pipeline.py"
}

resource "databricks_notebook" "transform_pipeline" {
  provider = databricks.workspace
  path     = "/Shared/notebooks/transform_pipeline"
  language = "PYTHON"
  source   = "${path.module}/../notebooks/transform_pipeline.py"
}

resource "databricks_job" "ingest_pipeline" {
  provider    = databricks.workspace
  name        = var.job_name
  description = var.job_description

  # Define shared job cluster for all tasks
  job_cluster {
    job_cluster_key = "shared_cluster"

    new_cluster {
      num_workers   = 1
      spark_version = data.databricks_spark_version.latest_lts.id
      node_type_id  = data.databricks_node_type.smallest.id

      spark_conf = {
        "spark.databricks.delta.preview.enabled" : true,
        "spark.databricks.io.cache.enabled" : true,
        "spark.sql.streaming.metricsEnabled" : true
      }

      spark_env_vars = {
        "KINESIS_STREAM_NAME" : var.stream_config.kinesis_stream_name,
        "KINESIS_ENDPOINT" : var.stream_config.kinesis_endpoint != null ? var.stream_config.kinesis_endpoint : "https://kinesis.${var.stream_config.aws_region}.amazonaws.com",
        "AWS_REGION" : var.stream_config.aws_region,
        "CATALOG_NAME" : var.catalog_config.catalog_name,
        "CENTRAL_SCHEMA" : var.catalog_config.central_schema
      }
    }
  }

  # Ingestion task
  task {
    task_key        = "ingest_data"
    job_cluster_key = "shared_cluster"

    notebook_task {
      notebook_path = databricks_notebook.ingest_pipeline.path
    }
  }

  # Transform task - depends on ingestion completing first
  task {
    task_key = "transform_data"
    depends_on {
      task_key = "ingest_data"
    }
    job_cluster_key = "shared_cluster"

    notebook_task {
      notebook_path = databricks_notebook.transform_pipeline.path
    }
  }
}
