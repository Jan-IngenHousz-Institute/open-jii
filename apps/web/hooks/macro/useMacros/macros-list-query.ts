import type { QueryUtils } from "@/lib/orpc";

import type { MacroLanguage, MacroSort } from "@repo/api/domains/macro/macro.schema";

interface MacrosListView {
  search?: string;
  language?: MacroLanguage;
  page: number;
  sort?: MacroSort;
}

/** One view of the macros list, built the same way for the hook and for the server. */
export function macrosListQuery(utils: QueryUtils, view: MacrosListView) {
  return utils.macros.listMacros.queryOptions({
    input: {
      search: view.search && view.search.trim() !== "" ? view.search : undefined,
      language: view.language,
      page: view.page,
      sort: view.sort?.length ? view.sort : undefined,
      fields: "summary",
    },
  });
}
