resource "databricks_pipeline" "ingest_pipeline" {
  name = var.pipeline_name

  target = var.target_schema_name

  edition = var.edition

  continuous = false

  cluster {
    autoscale {
      min_workers = var.cluster_autoscale_min_workers
      max_workers = var.cluster_autoscale_max_workers
    }

    node_type_id = data.databricks_node_type.smallest.id

    spark_conf = {
      "spark.databricks.photon.enabled"              = "true"
      "spark.databricks.delta.optimizeWrite.enabled" = "true"
      "spark.databricks.io.cache.enabled"            = "true"
      "spark.driver.memory"                          = "2g"
      "spark.executor.memory"                        = "2g"
      "spark.databricks.cluster.profile"             = "singleNode"
      "spark.databricks.repl.allowedLanguages"       = "python"
    }

    custom_tags = {
      "project"     = "open_jii"
      "environment" = "dev"
    }
  }

  development = true

  library {
    notebook {
      path = var.notebook_path
    }
  }
}
