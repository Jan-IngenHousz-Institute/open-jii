import type { ResourceSort } from "@/hooks/organization/useOrganizationResourceListState/useOrganizationResourceListState";
import { newestUpdateFirst } from "@/util/name-updated-sort";

import type { OrganizationResource } from "@repo/api/domains/organization/organization.schema";
import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

import { GROUP_ORDER } from "./organization-resource-meta";

export interface ResourceFilterState {
  query: string;
  /** The owned types to show; empty shows every type. */
  types: readonly SharingResourceType[];
  sort: ResourceSort;
}

/**
 * The rows to show, in order. Search matches the name only — descriptions carry rich-text
 * markup, so matching them would have a search for `p` hit nearly every row.
 *
 * Sorting by type orders by {@link GROUP_ORDER}, with recency inside each type, so the
 * list cannot read differently from the featured card or the estate bar.
 */
export function filterAndSortResources(
  resources: readonly OrganizationResource[],
  { query, types, sort }: ResourceFilterState,
): OrganizationResource[] {
  const needle = query.trim().toLowerCase();

  const matched = resources.filter(
    (resource) =>
      (types.length === 0 || types.includes(resource.type)) &&
      (needle === "" || resource.name.toLowerCase().includes(needle)),
  );

  // `filter` already returned a fresh array, so sorting in place cannot touch the
  // caller's — the featured card renders from the same one.
  if (sort === "name") {
    return matched.sort((a, b) => a.name.localeCompare(b.name));
  }
  if (sort === "type") {
    return matched.sort(
      (a, b) =>
        GROUP_ORDER.indexOf(a.type) - GROUP_ORDER.indexOf(b.type) || newestUpdateFirst(a, b),
    );
  }
  return matched.sort(newestUpdateFirst);
}
