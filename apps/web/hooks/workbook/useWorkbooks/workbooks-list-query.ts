import type { QueryUtils } from "@/lib/orpc";

import type { Visibility } from "@repo/api/domains/visibility/visibility.schema";
import type { WorkbookSort } from "@repo/api/domains/workbook/workbook.schema";

interface WorkbooksListView {
  search?: string;
  page: number;
  sort?: WorkbookSort;
  visibilities?: Visibility[];
}

/** One view of the workbooks list, built the same way for the hook and for the server. */
export function workbooksListQuery(utils: QueryUtils, view: WorkbooksListView) {
  return utils.workbooks.listWorkbooks.queryOptions({
    input: {
      search: view.search && view.search.trim() !== "" ? view.search : undefined,
      page: view.page,
      sort: view.sort?.length ? view.sort : undefined,
      visibility: view.visibilities?.length ? view.visibilities : undefined,
    },
  });
}
