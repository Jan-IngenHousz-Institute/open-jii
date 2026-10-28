import { zMacroLanguage } from "@repo/api/domains/macro/macro.schema";
import { zVisibility } from "@repo/api/domains/visibility/visibility.schema";

import { useListFilters } from "../../useListFilters";

const MACRO_LIST_FILTERS = { language: zMacroLanguage, visibility: zVisibility };

/** The macros list's URL filters. */
export function useMacroListFilters() {
  const { filters, setFilter, clearFilters, hasActiveFilters } = useListFilters(MACRO_LIST_FILTERS);

  return {
    languages: filters.language,
    visibilities: filters.visibility,
    setLanguages: (values: typeof filters.language) => setFilter("language", values),
    setVisibilities: (values: typeof filters.visibility) => setFilter("visibility", values),
    clearFilters,
    hasActiveFilters,
  };
}
