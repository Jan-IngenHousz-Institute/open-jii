import { z } from "zod";

/**
 * Schema for analytics configuration validation
 */
export const analyticsConfigSchema = z.object({
  posthogKey: z.string().optional(),
  posthogHost: z.string().url(),
  environment: z.string().optional(),
});

export type AnalyticsConfig = z.infer<typeof analyticsConfigSchema>;
