import type { QueryUtils } from "~/lib/orpc";

// Paginated, not the bare list: only that branch attaches `activity`.
export const userExperimentsQuery = (utils: QueryUtils) =>
  utils.experiments.listExperiments.queryOptions({
    input: { scope: "related", page: 1, pageSize: 3 },
  });

export const PUBLIC_EXPERIMENTS_PAGE_SIZE = 6;

export const publicExperimentsQuery = (utils: QueryUtils) =>
  utils.experiments.listExperiments.queryOptions({
    input: {
      scope: "all",
      visibility: "public",
      sort: [{ field: "updated", direction: "desc" }],
      page: 1,
      pageSize: PUBLIC_EXPERIMENTS_PAGE_SIZE,
    },
  });
