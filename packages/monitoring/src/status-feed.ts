import { z } from "zod/mini";

import { cachedStatusContentSchema } from "./status-content.js";
import type { CachedStatusContent } from "./status-content.js";
import { announcedSchema } from "./status-events.js";
import { minuteOf } from "./status-history.js";

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

/**
 * The website shares the Contentful space's monthly API quota, and a read every minute from both
 * environments would use most of it.
 */
export const CONTENT_READ_MINUTES = 5;

/** How long the page may run on the cached incidents before a failed Contentful read fails the run. */
export const CONTENT_STALE_MINUTES = 15;

/**
 * Whether this run reads Contentful. A failed read keeps the older cache, so the next run tries
 * again rather than waiting out another interval.
 */
export function isContentDue(cached: CachedStatusContent | undefined, now: Date): boolean {
  if (cached === undefined) {
    return true;
  }

  return minuteOf(now) - minuteOf(new Date(cached.fetchedAt)) >= CONTENT_READ_MINUTES;
}

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
