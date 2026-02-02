import { registerAs } from "@nestjs/config";

/**
 * Databricks configuration values from environment variables
 */
export default registerAs("databricks", () => ({
  host: process.env.DATABRICKS_HOST,
  clientId: process.env.DATABRICKS_CLIENT_ID,
  clientSecret: process.env.DATABRICKS_CLIENT_SECRET,
  ambyteProcessingJobId: process.env.DATABRICKS_AMBYTE_PROCESSING_JOB_ID,
  enrichedTablesRefreshJobId: process.env.DATABRICKS_ENRICHED_TABLES_REFRESH_JOB_ID,
  warehouseId: process.env.DATABRICKS_WAREHOUSE_ID,
  catalogName: process.env.DATABRICKS_CATALOG_NAME,
  webhookApiKeys: {
    [process.env.DATABRICKS_WEBHOOK_API_KEY_ID!]: process.env.DATABRICKS_WEBHOOK_API_KEY,
  },
  webhookSecret: process.env.DATABRICKS_WEBHOOK_SECRET,
  // Schema name with default (can be overridden via environment variables)
  centrumSchemaName: process.env.DATABRICKS_CENTRUM_SCHEMA_NAME ?? "centrum",
  // Table names with defaults (can be overridden via environment variables)
  rawDataTableName: process.env.DATABRICKS_RAW_DATA_TABLE_NAME ?? "enriched_experiment_raw_data",
  deviceDataTableName: process.env.DATABRICKS_DEVICE_DATA_TABLE_NAME ?? "experiment_device_data",
  rawAmbyteDataTableName: process.env.DATABRICKS_RAW_AMBYTE_DATA_TABLE_NAME ?? "raw_ambyte_data",
  macroDataTableName:
    process.env.DATABRICKS_MACRO_DATA_TABLE_NAME ?? "enriched_experiment_macro_data",
}));
