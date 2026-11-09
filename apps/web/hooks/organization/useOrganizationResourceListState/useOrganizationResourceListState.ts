"use client";

import { z } from "zod";

import { zSharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

import { useListUrlState } from "../../useListUrlState";

const ORGANIZATION_RESOURCE_FILTERS = { type: zSharingResourceType };

/** How the list is ordered. `recent` is the default: the last thing touched, first. */
export type ResourceSort = "recent" | "name" | "type";

/** The sort control only ever orders ascending, so a URL asking for more falls back to recent. */
const zOrganizationResourceSort = z
  .array(z.object({ field: z.enum(["name", "type"]), direction: z.literal("asc") }))
  .max(1);

/**
 * The organization resources list's search, type filter and sort, in the URL. The list holds one
 * organization's rows, so it filters and sorts in the browser; the sort allowlist is local
 * because it never reaches the API.
 */
export function useOrganizationResourceListState() {
  const state = useListUrlState({
    searchKey: "q",
    filters: ORGANIZATION_RESOURCE_FILTERS,
    sort: zOrganizationResourceSort,
  });

  return {
    filters: state.filters,
    setFilter: state.setFilter,
    clearFilters: state.clearFilters,
    hasActiveFilters: state.hasActiveFilters,
    query: state.search,
    setQuery: state.setSearch,
    /** No sort in the URL is the default, most recently updated first. */
    sort: (state.sort[0]?.field ?? "recent") satisfies ResourceSort,
    setSort: (sort: ResourceSort) =>
      state.setSort(sort === "recent" ? [] : [{ field: sort, direction: "asc" }]),
  };
}
