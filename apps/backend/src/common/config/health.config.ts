import { registerAs } from "@nestjs/config";

export default registerAs("health", () => ({
  // Only deployed services are given one, so a local run, compose included, never checks or
  // publishes.
  databaseClusterIdentifier: process.env.DB_CLUSTER_IDENTIFIER,
  environment: process.env.ENVIRONMENT_PREFIX,
}));
