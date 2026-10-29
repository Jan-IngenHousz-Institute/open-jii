import type { QueryUtils } from "@/lib/orpc";

import type { MacroLanguage, MacroSort } from "@repo/api/domains/macro/macro.schema";
import type { Visibility } from "@repo/api/domains/visibility/visibility.schema";

interface MacrosListView {
  search?: string;
  page: number;
  sort?: MacroSort;
  languages?: MacroLanguage[];
  visibilities?: Visibility[];
}

/** One view of the macros list, built the same way for the hook and for the server. */
export function macrosListQuery(utils: QueryUtils, view: MacrosListView) {
  return utils.macros.listMacros.queryOptions({
    input: {
      search: view.search && view.search.trim() !== "" ? view.search : undefined,
      page: view.page,
      sort: view.sort?.length ? view.sort : undefined,
      language: view.languages?.length ? view.languages : undefined,
      visibility: view.visibilities?.length ? view.visibilities : undefined,
      fields: "summary",
    },
  });
}
