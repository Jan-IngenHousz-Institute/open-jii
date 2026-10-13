import type { QueryUtils } from "~/lib/orpc";

export const userExperimentsQuery = (utils: QueryUtils) =>
  utils.experiments.listHomeExperiments.queryOptions({
    input: { limit: 3 },
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
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
