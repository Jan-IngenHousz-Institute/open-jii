import { registerAs } from "@nestjs/config";

/**
 * Analytics (PostHog) configuration values from environment variables
 */
export default registerAs("analytics", () => ({
  posthogKey: process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY,
  posthogHost:
    process.env.POSTHOG_HOST ?? process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
}));
