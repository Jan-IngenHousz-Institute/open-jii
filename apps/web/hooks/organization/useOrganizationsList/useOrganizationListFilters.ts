import { zOrganizationType } from "@repo/api/domains/organization/organization.schema";

import { useListFilters } from "../../useListFilters";

const ORGANIZATION_LIST_FILTERS = { type: zOrganizationType };

/**
 * The directory's comma-separated `type` URL filter. Unknown values and duplicates
 * are discarded. Clearing removes the type selection while preserving search and sort.
 */
export function useOrganizationListFilters() {
  const { filters, setFilter, clearFilters, hasActiveFilters } =
    useListFilters(ORGANIZATION_LIST_FILTERS);

  return {
    types: filters.type,
    setTypes: (values: typeof filters.type) => setFilter("type", values),
    clearFilters,
    hasActiveFilters,
  };
}
