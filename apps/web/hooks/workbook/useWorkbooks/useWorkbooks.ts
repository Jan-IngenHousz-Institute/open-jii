import { orpc } from "@/lib/orpc";

import { zVisibility } from "@repo/api/domains/visibility/visibility.schema";
import { zWorkbookSort } from "@repo/api/domains/workbook/workbook.schema";

import { useResourceList } from "../../useResourceList";
import { workbooksListQuery } from "./workbooks-list-query";

const WORKBOOK_LIST_FILTERS = { visibility: zVisibility };

/** The workbooks list: visibility filter, search and sort in the URL, server-paged. */
export function useWorkbooks() {
  return useResourceList({
    searchKey: "q",
    filters: WORKBOOK_LIST_FILTERS,
    sort: zWorkbookSort,
    query: (view) =>
      workbooksListQuery(orpc, {
        search: view.search,
        page: view.page,
        sort: view.sort,
        visibilities: view.filters.visibility,
      }),
  });
}
