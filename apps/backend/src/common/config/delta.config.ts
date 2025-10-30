import { registerAs } from "@nestjs/config";

/**
 * Delta Sharing configuration values from environment variables
 */
export default registerAs("delta", () => ({
  endpoint: process.env.DELTA_ENDPOINT,
  bearerToken: process.env.DELTA_BEARER_TOKEN,
  requestTimeout: process.env.DELTA_REQUEST_TIMEOUT,
  maxRetries: process.env.DELTA_MAX_RETRIES,
}));
