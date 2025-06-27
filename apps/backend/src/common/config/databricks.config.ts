import { registerAs } from "@nestjs/config";

export default registerAs("databricks", () => ({
  host: process.env.DATABRICKS_HOST,
  clientId: process.env.DATABRICKS_CLIENT_ID,
  clientSecret: process.env.DATABRICKS_CLIENT_SECRET,
  jobId: process.env.DATABRICKS_JOB_ID,
  warehouseId: process.env.DATABRICKS_WAREHOUSE_ID,
  catalogName: process.env.DATABRICKS_CATALOG_NAME,
  webhookApiKey: process.env.DATABRICKS_WEBHOOK_API_KEY,
}));
