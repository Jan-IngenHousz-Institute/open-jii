import { registerAs } from "@nestjs/config";

/**
 * Analytics (PostHog) configuration values from environment variables
 */
export default registerAs("analytics", () => ({
  posthogKey: process.env.POSTHOG_KEY,
  posthogHost: process.env.POSTHOG_HOST,
  // dev or prod on the deployed service; one PostHog project serves both.
  environment: process.env.ENVIRONMENT_PREFIX,
}));
