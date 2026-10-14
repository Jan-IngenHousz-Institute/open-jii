import { zOrganizationType } from "@repo/api/domains/organization/organization.schema";

import { useListFilters } from "../../useListFilters";

const ORGANIZATION_LIST_FILTERS = { type: zOrganizationType };

/** The organization directory's URL filters. */
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
