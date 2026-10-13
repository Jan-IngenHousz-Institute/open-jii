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
  const statuses = archived ? [] : filters.status;
  const visibilities = filters.visibility;

  return {
    statuses,
    visibilities,
    setStatuses: (values: typeof filters.status) => setFilter("status", values),
    setVisibilities: (values: typeof visibilities) => setFilter("visibility", values),
    clearFilters,
    hasActiveFilters: statuses.length > 0 || visibilities.length > 0,
  };
}
