import { orpc } from "@/lib/orpc";

import {
  zExperimentSort,
  zExperimentStatus,
  zExperimentVisibility,
} from "@repo/api/domains/experiment/experiment.schema";

import { useResourceList } from "../../useResourceList";
import { experimentsListQuery } from "./experiments-list-query";

const EXPERIMENT_LIST_FILTERS = {
  // Archived rows have their own page, so the main list never offers that status.
  status: zExperimentStatus.exclude(["archived"]),
  visibility: zExperimentVisibility,
};

/**
 * The experiments list: status and visibility filters, search and sort in the URL, server-paged.
 * `archived` lists related archived experiments; a stray `status` param there is neither
 * applied nor counted as an active filter.
 */
export function useExperiments({ archived = false }: { archived?: boolean } = {}) {
  const list = useResourceList({
    searchKey: "q",
    filters: EXPERIMENT_LIST_FILTERS,
    sort: zExperimentSort,
    query: (view) =>
      experimentsListQuery(orpc, {
        archived,
        statuses: view.filters.status,
        visibilities: view.filters.visibility,
        search: view.search,
        page: view.page,
        sort: view.sort,
      }),
  });

  if (!archived) return list;
  return {
    ...list,
    filters: { ...list.filters, status: [] },
    hasActiveFilters: list.filters.visibility.length > 0,
  };
}
