import { z } from "zod";

/**
 * Schema for analytics configuration validation
 */
export const analyticsConfigSchema = z.object({
  posthogKey: z.string().optional(),
  posthogHost: z.string().url(),
});

export type AnalyticsConfig = z.infer<typeof analyticsConfigSchema>;
