import { z } from "zod";

/** What a feed item represents. */
export const zFeedItemKind = z.enum([
  "experiment",
  "protocol",
  "macro",
  "workbook",
  "organization-joined",
]);

/**
 * One entry in the personal activity feed. For resource kinds, `id` is the
 * resource id and `timestamp` is its last update; for `organization-joined`,
 * `id` is the organization id and `timestamp` is when you joined.
 */
export const zFeedItem = z.object({
  kind: zFeedItemKind,
  id: z.string().uuid(),
  title: z.string(),
  organizationId: z.string().uuid().nullable(),
  organizationName: z.string().nullable(),
  visibility: z.enum(["private", "public"]).nullable(),
  timestamp: z.string().datetime(),
});

export const zFeedItemList = z.array(zFeedItem);

export const zFeedQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export type FeedItemKind = z.infer<typeof zFeedItemKind>;
export type FeedItem = z.infer<typeof zFeedItem>;
export type FeedQuery = z.infer<typeof zFeedQuery>;
