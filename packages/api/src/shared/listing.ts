import { z } from "zod";

/** `related` narrows to rows the caller is tied to (authorship, any grant, owning-org membership). */
export const zResourceScope = z.enum(["related", "all"]);

/**
 * Page selector for the list procedures. Both are optional and neither carries a schema
 * default: `page` presence is what switches a listing from an array to an envelope, so a
 * default here would silently paginate every caller. The server applies
 * {@link DEFAULT_PAGE_SIZE} once it has decided the request is paginated.
 */
export const zPaginationQuery = z.object({
  page: z.coerce.number().int().min(1).optional().describe("1-based page number"),
  pageSize: z.coerce.number().int().min(1).max(100).optional().describe("Rows per page"),
});

/** Applied server-side when `page` is present and `pageSize` is not. */
export const DEFAULT_PAGE_SIZE = 20;

/** `totalCount` comes from a separate count query, so an out-of-range page still reports real totals. */
export function zPaginated<T extends z.ZodTypeAny>(items: T) {
  return z.object({
    items: z.array(items),
    page: z.number().int(),
    pageSize: z.number().int(),
    totalPages: z.number().int(),
    totalCount: z.number().int(),
  });
}

/**
 * A listing response: a bare array, or the envelope when the caller asked for a page.
 * The runtime contract is exactly that, in both directions: the response is an array
 * if and only if the request carried no `page`.
 */
export type ListResponse<T> = T[] | PaginatedList<T>;

export interface PaginatedList<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
}

/** Narrow a listing response to the envelope. */
export function isPaginatedList<T>(response: ListResponse<T>): response is PaginatedList<T> {
  return !Array.isArray(response);
}

/** The rows out of a listing response, whichever shape it came back in. */
export function listItems<T>(response: ListResponse<T> | undefined): T[] {
  if (!response) return [];
  return isPaginatedList(response) ? response.items : response;
}

/** `scope` wins over the deprecated `filter` alias; a bare legacy `filter` still means "mine". */
export function resolveListScope(input: {
  scope?: ResourceScope;
  filter?: "member" | "my";
}): ResourceScope {
  return input.scope ?? (input.filter ? "related" : "all");
}

export type ResourceScope = z.infer<typeof zResourceScope>;
export type PaginationQuery = z.infer<typeof zPaginationQuery>;
