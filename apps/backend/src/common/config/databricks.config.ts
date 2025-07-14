import { registerAs } from "@nestjs/config";

/**
 * Databricks configuration values from environment variables
 */
export default registerAs("databricks", () => ({
  host: process.env.DATABRICKS_HOST,
  clientId: process.env.DATABRICKS_CLIENT_ID,
  clientSecret: process.env.DATABRICKS_CLIENT_SECRET,
  jobId: process.env.DATABRICKS_JOB_ID,
  warehouseId: process.env.DATABRICKS_WAREHOUSE_ID,
  catalogName: process.env.DATABRICKS_CATALOG_NAME,
  webhookApiKeys: {
    [process.env.DATABRICKS_WEBHOOK_API_KEY_ID!]: process.env.DATABRICKS_WEBHOOK_API_KEY,
  },
  webhookSecret: process.env.DATABRICKS_WEBHOOK_SECRET,
}));
