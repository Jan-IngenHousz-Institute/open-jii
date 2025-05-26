import { registerAs } from "@nestjs/config";

export default registerAs("databricks", () => ({
  host: process.env.DATABRICKS_HOST,
  clientId: process.env.DATABRICKS_CLIENT_ID,
  clientSecret: process.env.DATABRICKS_CLIENT_SECRET,
  jobId: process.env.DATABRICKS_JOB_ID,
}));
