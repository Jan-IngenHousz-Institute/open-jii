import { z } from "zod";

/** Query params for global cross-entity search. */
export const zGlobalSearchQuery = z.object({
  query: z.string().trim().min(1).max(200).describe("Search term"),
  // The backend caps each entity type at 8 results across 4 types, so 32 is the most that can ever
  // be returned — advertise that ceiling instead of over-promising up to 50.
  limit: z.coerce.number().int().min(1).max(32).optional().default(20),
});

/** Entity types surfaced by global search (users are intentionally excluded — no profile page). */
export const zSearchResultType = z.enum(["experiment", "protocol", "macro", "workbook"]);

/** A single normalized, ranked search result. */
export const zSearchResult = z.object({
  type: zSearchResultType,
  id: z.string().uuid(),
  title: z.string(),
  subtitle: z.string().nullable(),
  /**
   * Short type-specific label shown beside the title (e.g. a macro's language or a protocol's
   * sensor family). `null` when the type has no such label (experiments).
   */
  meta: z.string().nullable(),
});

/** Flat, cross-type relevance-ordered results. The client groups by `type` for display. */
export const zGlobalSearchResponse = z.object({
  results: z.array(zSearchResult),
});

export const zSearchErrorResponse = z.object({
  message: z.string(),
  statusCode: z.number(),
});

export type GlobalSearchQuery = z.infer<typeof zGlobalSearchQuery>;
export type SearchResultType = z.infer<typeof zSearchResultType>;
export type SearchResult = z.infer<typeof zSearchResult>;
export type GlobalSearchResponse = z.infer<typeof zGlobalSearchResponse>;
export type SearchErrorResponse = z.infer<typeof zSearchErrorResponse>;
