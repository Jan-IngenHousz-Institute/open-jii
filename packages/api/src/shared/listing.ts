import { z } from "zod";

/** `related` narrows to rows the caller is tied to (authorship, any grant, owning-org membership). */
export const zResourceScope = z.enum(["related", "all"]);

export const zPaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1).describe("1-based page number"),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).describe("Rows per page"),
});

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

/** `scope` wins over the deprecated `filter` alias; a bare legacy `filter` still means "mine". */
export function resolveListScope(input: {
  scope?: ResourceScope;
  filter?: "member" | "my";
}): ResourceScope {
  return input.scope ?? (input.filter ? "related" : "all");
}

export type ResourceScope = z.infer<typeof zResourceScope>;
export type PaginationQuery = z.infer<typeof zPaginationQuery>;
