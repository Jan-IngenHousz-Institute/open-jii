import type { QueryUtils } from "@/lib/orpc";

import type {
  ExperimentSort,
  ExperimentStatus,
} from "@repo/api/domains/experiment/experiment.schema";

interface ExperimentsListView {
  archived: boolean;
  status?: ExperimentStatus;
  search?: string;
  page: number;
  sort?: ExperimentSort;
}

/** One view of the experiments list, built the same way for the hook and for the server. */
export function experimentsListQuery(utils: QueryUtils, view: ExperimentsListView) {
  return utils.experiments.listExperiments.queryOptions({
    input: {
      scope: view.archived ? "related" : undefined,
      status: view.archived ? "archived" : view.status,
      search: view.search && view.search.trim() !== "" ? view.search : undefined,
      page: view.page,
      sort: view.sort?.length ? view.sort : undefined,
    },
  });
}
