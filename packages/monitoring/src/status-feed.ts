import { z } from "zod/mini";

import { cachedStatusContentSchema } from "./status-content.js";
import { announcedSchema } from "./status-events.js";

export const STATUS_FEED_STATE_VERSION = 1;

/**
 * What the publisher carries beside its history. It is written only once the events are sent, so a
 * failed send leaves the old snapshot and the same events come up again on the next run.
 */
export const statusFeedStateSchema = z.object({
  version: z.literal(STATUS_FEED_STATE_VERSION),
  announced: announcedSchema,
  content: z.optional(cachedStatusContentSchema),
});
export type StatusFeedState = z.infer<typeof statusFeedStateSchema>;
