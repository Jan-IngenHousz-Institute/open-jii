import { z } from "zod/mini";

import { cachedStatusContentSchema } from "./status-content.js";
import type { CachedStatusContent } from "./status-content.js";
import { announcedSchema } from "./status-events.js";

export const STATUS_FEED_STATE_VERSION = 1;

/**
 * What the publisher carries beside its history. It is written only once the events are sent, so a
 * failed send leaves the old snapshot and the same events come up again on the next run.
 */
export const statusFeedStateSchema = z.object({
  version: z.literal(STATUS_FEED_STATE_VERSION),
  announced: announcedSchema,
  content: cachedStatusContentSchema,
});
export type StatusFeedState = z.infer<typeof statusFeedStateSchema>;

const MINUTE_MS = 60_000;

/** How long the page may run on the cached incidents before a failed Contentful read fails the run. */
export const CONTENT_STALE_MINUTES = 15;

/**
 * What a failed Contentful read owes the errors alarm: nothing while the cached content is recent,
 * and past that, or with no cache, the reason the run fails once it has written everything.
 */
export function contentFailure(
  cause: string | undefined,
  cached: CachedStatusContent | undefined,
  now: Date,
): string | undefined {
  if (cause === undefined) {
    return undefined;
  }

  if (cached === undefined) {
    return `Contentful is unreadable and no earlier read is kept: ${cause}`;
  }

  const unreadableMs = now.getTime() - Date.parse(cached.fetchedAt);
  if (unreadableMs <= CONTENT_STALE_MINUTES * MINUTE_MS) {
    return undefined;
  }

  const minutes = Math.floor(unreadableMs / MINUTE_MS);
  return `Contentful has been unreadable for ${minutes} minutes, since ${cached.fetchedAt}: ${cause}`;
}
