import { z } from "zod/mini";

import { cachedStatusContentSchema } from "./status-content.js";
import type { CachedStatusContent } from "./status-content.js";
import {
  announcedSchema,
  batchEvents,
  failedEntriesText,
  statusEventSchema,
} from "./status-events.js";
import type { Announced, EventMessage, FailedEntry, StatusEvent } from "./status-events.js";
import { minuteOf } from "./status-history.js";

export const STATUS_FEED_STATE_VERSION = 1;

/** What the publisher carries beside its history. */
export const statusFeedStateSchema = z.object({
  version: z.literal(STATUS_FEED_STATE_VERSION),
  announced: announcedSchema,
  content: cachedStatusContentSchema,
  /** Events of this snapshot or an earlier one that SNS has not taken yet, oldest first. */
  pending: z.array(statusEventSchema),
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
 * Whether this run reads Contentful: once an interval has passed since the last good read and
 * since the last failed one, so a read that keeps failing, such as one for a content type that
 * does not exist yet, is not repeated every minute.
 */
export function isContentDue(
  cached: CachedStatusContent | undefined,
  lastFailedAt: Date | undefined,
  now: Date,
): boolean {
  const lastReadAt = cached === undefined ? undefined : new Date(cached.fetchedAt);

  return [lastReadAt, lastFailedAt].every(
    (at) => at === undefined || minuteOf(now) - minuteOf(at) >= CONTENT_READ_MINUTES,
  );
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

/** Sends one SNS batch and gives back the entries SNS refused; a request that fails throws. */
export type SendBatch = (batch: EventMessage[]) => Promise<FailedEntry[]>;

export interface AnnounceInput {
  feed: StatusFeedState | undefined;
  events: StatusEvent[];
  announced: Announced;
  content: CachedStatusContent;
  send: SendBatch;
  save: (state: StatusFeedState) => Promise<void>;
}

export interface AnnounceOutcome {
  sent: number;
  /** Left out rather than retried, since SNS refuses them at any try and would block the rest. */
  tooLarge: StatusEvent[];
  /** Why some events are still pending, when any are. */
  failure: string | undefined;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Saves this run's snapshot with every event not sent yet, an earlier run's first, then sends them
 * and saves again without those SNS took. A failed send leaves its events for the next run, and a
 * save that fails after a send repeats those events rather than losing them.
 */
export async function announceEvents(input: AnnounceInput): Promise<AnnounceOutcome> {
  const { feed, events, announced, content, send, save } = input;
  const { batches, tooLarge } = batchEvents([...(feed?.pending ?? []), ...events]);
  const queued = batches.flat().map(({ event }) => event);
  const stateWith = (pending: StatusEvent[]): StatusFeedState => ({
    version: STATUS_FEED_STATE_VERSION,
    announced,
    content,
    pending,
  });

  await save(stateWith(queued));
  if (queued.length === 0) {
    return { sent: 0, tooLarge, failure: undefined };
  }

  const unsent: StatusEvent[] = [];
  const failures: string[] = [];
  for (const [index, batch] of batches.entries()) {
    const sent = batch.map(({ event }) => event);

    try {
      const failed = await send(batch);
      const refused = new Set(failed.map(({ Id }) => Id));
      unsent.push(...sent.filter((_, position) => refused.has(String(position))));
      if (failed.length > 0) {
        failures.push(`SNS rejected status events: ${failedEntriesText(sent, failed)}`);
      }
    } catch (error) {
      unsent.push(...batches.slice(index).flatMap((rest) => rest.map(({ event }) => event)));
      failures.push(`SNS could not be reached: ${errorText(error)}`);
      break;
    }
  }

  await save(stateWith(unsent));

  return {
    sent: queued.length - unsent.length,
    tooLarge,
    failure: failures.length > 0 ? failures.join("; ") : undefined,
  };
}
