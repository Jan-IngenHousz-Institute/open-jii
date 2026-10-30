# Account identity is created by the standalone app's sandbox infrastructure.
# Catalog/schema/table privileges belong to this product stack, not its bootstrap role.
data "databricks_service_principal" "instrument_tracking" {
  provider     = databricks.mws
  display_name = "jii-instrument-tracking-prod"
}

resource "databricks_grant" "instrument_tracking_clean_data" {
  provider   = databricks.workspace
  table      = "${module.databricks_catalog.catalog_name}.centrum.clean_data"
  principal  = data.databricks_service_principal.instrument_tracking.application_id
  privileges = ["SELECT"]
  depends_on = [databricks_grants.centrum_schema]
}
