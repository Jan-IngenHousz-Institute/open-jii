# Temporary file — remove after successful `terraform apply`

import {
  to = module.openjii_project_transfer_requests_table.databricks_sql_table.this
  id = "open_jii_dev.centrum.openjii_project_transfer_requests"
}

import {
  to = module.experiment_annotations_table.databricks_sql_table.this
  id = "open_jii_dev.centrum.experiment_annotations"
}

import {
  to = module.experiment_export_metadata_table.databricks_sql_table.this
  id = "open_jii_dev.centrum.experiment_export_metadata"
}
