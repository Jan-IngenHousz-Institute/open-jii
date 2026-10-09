import { registerAs } from "@nestjs/config";

export default registerAs("health", () => ({
  // Only the deployed service checks and publishes, so a local run never writes to CloudWatch.
  deployed: process.env.NODE_ENV === "production",
  environment: process.env.ENVIRONMENT_PREFIX,
  databaseClusterIdentifier: process.env.DB_CLUSTER_IDENTIFIER,
}));
