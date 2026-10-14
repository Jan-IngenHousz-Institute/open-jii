import { zVisibility } from "@repo/api/domains/visibility/visibility.schema";

import { useListFilters } from "../../useListFilters";

const WORKBOOK_LIST_FILTERS = { visibility: zVisibility };

/** The workbooks list's URL filters. */
export function useWorkbookListFilters() {
  const { filters, setFilter, clearFilters, hasActiveFilters } =
    useListFilters(WORKBOOK_LIST_FILTERS);

  return {
    visibilities: filters.visibility,
    setVisibilities: (values: typeof filters.visibility) => setFilter("visibility", values),
    clearFilters,
    hasActiveFilters,
  };
}
