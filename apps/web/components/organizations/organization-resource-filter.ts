import type { OrganizationResource } from "@repo/api/domains/organization/organization.schema";
import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

import { GROUP_ORDER } from "./organization-resource-meta";

/** How the list is ordered. `recent` is the default: the last thing touched, first. */
export type ResourceSort = "recent" | "name" | "type";

/** The type filter's value — one of the owned types, or every one of them. */
export type ResourceTypeFilter = SharingResourceType | "all";

export interface ResourceFilterState {
  query: string;
  type: ResourceTypeFilter;
  sort: ResourceSort;
}

export const DEFAULT_RESOURCE_FILTER: ResourceFilterState = {
  query: "",
  type: "all",
  sort: "recent",
};

/**
 * The rows to show, in order. Search matches the name only — descriptions carry rich-text
 * markup, so matching them would have a search for `p` hit nearly every row.
 *
 * Sorting by type orders by {@link GROUP_ORDER}, with recency inside each type, so the
 * list cannot read differently from the featured card or the estate bar.
 */
export function filterAndSortResources(
  resources: readonly OrganizationResource[],
  { query, type, sort }: ResourceFilterState,
): OrganizationResource[] {
  const needle = query.trim().toLowerCase();

  const matched = resources.filter(
    (resource) =>
      (type === "all" || resource.type === type) &&
      (needle === "" || resource.name.toLowerCase().includes(needle)),
  );

  const byRecency = (a: OrganizationResource, b: OrganizationResource) =>
    Date.parse(b.updatedAt) - Date.parse(a.updatedAt);

  // `filter` already returned a fresh array, so sorting in place cannot touch the
  // caller's — the featured card renders from the same one.
  if (sort === "name") {
    return matched.sort((a, b) => a.name.localeCompare(b.name));
  }
  if (sort === "type") {
    return matched.sort(
      (a, b) => GROUP_ORDER.indexOf(a.type) - GROUP_ORDER.indexOf(b.type) || byRecency(a, b),
    );
  }
  return matched.sort(byRecency);
}

/** Whether anything is narrowing the list — what the empty state and the reset key off. */
export function hasActiveFilters({ query, type }: ResourceFilterState): boolean {
  return query.trim() !== "" || type !== "all";
}
