<<<<<<< HEAD
import type { ExperimentStatus } from "@repo/api";
=======
import { useState, useMemo } from "react";
>>>>>>> 59bc34f (feat(web): Add filtering capability to experiments list and format date utility)

import { tsr } from "../../../lib/tsr";

export type ExperimentFilter = "my" | "member" | "related" | "all";

/**
<<<<<<< HEAD
 * Hook to fetch a list of experiments with optional filtering
 * @param userId The ID of the current user
 * @param filter Optional filter for experiments ('my', 'member', or 'related')
 * @param status Optional filter for experiments by status ('provisioning', 'active', etc.)
 * @returns Query result containing list of experiments
 */
export const useExperiments = (
  filter?: "my" | "member" | "related",
  status?: ExperimentStatus,
) => {
  return tsr.experiments.listExperiments.useQuery({
    queryData: { query: { filter, status } },
    queryKey: ["experiments", filter, status],
=======
 * Hook to fetch a list of experiments with filtering capability
 * @param initialFilter Optional initial filter value (defaults to "my")
 * @returns Query result containing list of experiments and filter state management
 */
export const useExperiments = (initialFilter: ExperimentFilter = "my") => {
  const [filter, setFilter] = useState<ExperimentFilter>(initialFilter);

  // When filter is "all", we don't pass any filter to the API
  const actualFilter = useMemo(() => {
    return filter === "all" ? undefined : filter;
  }, [filter]);

  const queryResult = tsr.experiments.listExperiments.useQuery({
    queryData: { query: { filter: actualFilter } },
    queryKey: ["experiments", filter],
>>>>>>> 59bc34f (feat(web): Add filtering capability to experiments list and format date utility)
  });

  return {
    ...queryResult,
    filter,
    setFilter,
  };
};
