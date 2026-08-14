import { registerAs } from "@nestjs/config";

/**
 * Delta Sharing endpoint configuration; the DuckDB read engine fetches
 * pre-signed parquet file URLs through this protocol.
 */
export default registerAs("delta", () => ({
  endpoint: process.env.DELTA_ENDPOINT,
  bearerToken: process.env.DELTA_BEARER_TOKEN,
  shareName: process.env.DELTA_SHARE_NAME,
  schemaName: process.env.DELTA_SCHEMA_NAME,
  requestTimeout: process.env.DELTA_REQUEST_TIMEOUT,
}));
