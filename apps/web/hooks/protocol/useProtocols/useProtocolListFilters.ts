import { zProtocolFamily } from "@repo/api/domains/protocol/protocol.schema";
import { zVisibility } from "@repo/api/domains/visibility/visibility.schema";

import { useListFilters } from "../../useListFilters";

const PROTOCOL_LIST_FILTERS = { family: zProtocolFamily, visibility: zVisibility };

/** The protocols list's URL filters. */
export function useProtocolListFilters() {
  const { filters, setFilter, clearFilters, hasActiveFilters } =
    useListFilters(PROTOCOL_LIST_FILTERS);

  return {
    families: filters.family,
    visibilities: filters.visibility,
    setFamilies: (values: typeof filters.family) => setFilter("family", values),
    setVisibilities: (values: typeof filters.visibility) => setFilter("visibility", values),
    clearFilters,
    hasActiveFilters,
  };
}
