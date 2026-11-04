import { orpc } from "@/lib/orpc";

import { zMacroLanguage, zMacroSort } from "@repo/api/domains/macro/macro.schema";
import { zVisibility } from "@repo/api/domains/visibility/visibility.schema";

import { useResourceList } from "../../useResourceList";
import { macrosListQuery } from "./macros-list-query";

const MACRO_LIST_FILTERS = { language: zMacroLanguage, visibility: zVisibility };

/** The macros list: language and visibility filters and sort in the URL, server-paged. */
export function useMacros() {
  return useResourceList({
    filters: MACRO_LIST_FILTERS,
    sort: zMacroSort,
    query: (view) =>
      macrosListQuery(orpc, {
        search: view.search,
        page: view.page,
        sort: view.sort,
        languages: view.filters.language,
        visibilities: view.filters.visibility,
      }),
  });
}
