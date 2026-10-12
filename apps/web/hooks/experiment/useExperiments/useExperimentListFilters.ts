import {
  zExperimentStatus,
  zExperimentVisibility,
} from "@repo/api/domains/experiment/experiment.schema";

import { useListFilters } from "../../useListFilters";

/** Archived rows have their own page, so the main list never offers that status. */
export const EXPERIMENT_STATUS_FILTER_VALUES = zExperimentStatus.exclude(["archived"]);

const EXPERIMENT_LIST_FILTERS = {
  status: EXPERIMENT_STATUS_FILTER_VALUES,
  visibility: zExperimentVisibility,
};

/**
 * The experiments list's URL filters. The archive page lists one status only, so there a
 * stray `status` param is neither applied nor counted as an active filter.
 */
export function useExperimentListFilters({ archived }: { archived: boolean }) {
  const { filters, setFilter, clearFilters } = useListFilters(EXPERIMENT_LIST_FILTERS);
  const status = archived ? [] : filters.status;
  const { visibility } = filters;

  return {
    status,
    visibility,
    setStatus: (values: typeof filters.status) => setFilter("status", values),
    setVisibility: (values: typeof visibility) => setFilter("visibility", values),
    clearFilters,
    hasActiveFilters: status.length > 0 || visibility.length > 0,
  };
}
