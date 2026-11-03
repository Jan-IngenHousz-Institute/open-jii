"use client";

import { z } from "zod";

import { zSharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

import { useListUrlState } from "../../useListUrlState";

const ORGANIZATION_RESOURCE_FILTERS = { type: zSharingResourceType };

/** The sort control only ever orders ascending, so a URL asking for more falls back to recent. */
const zOrganizationResourceSort = z
  .array(z.object({ field: z.enum(["name", "type"]), direction: z.literal("asc") }))
  .max(1);

type NamedSort = "name" | "type";

/**
 * The organization resources list's type filter and sort, in the URL. The list holds one
 * organization's rows, so it filters and sorts in the browser; the sort allowlist is local
 * because it never reaches the API. Search stays in memory, as on most resource lists.
 */
export function useOrganizationResourceListState() {
  const state = useListUrlState({
    filters: ORGANIZATION_RESOURCE_FILTERS,
    sort: zOrganizationResourceSort,
  });

  return {
    filterShape: ORGANIZATION_RESOURCE_FILTERS,
    filters: state.filters,
    setFilter: state.setFilter,
    clearFilters: state.clearFilters,
    hasActiveFilters: state.hasActiveFilters,
    query: state.search,
    setQuery: state.setSearch,
    /** No sort in the URL is the default, most recently updated first. */
    sort: state.sort[0]?.field ?? "recent",
    setSort: (sort: NamedSort | "recent") =>
      state.setSort(sort === "recent" ? [] : [{ field: sort, direction: "asc" }]),
  };
}
