"use client";

import { useMemo } from "react";
import { z } from "zod";

import type { ExperimentDataFilter } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { zExperimentDataFilter } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { useUrlState } from "./useUrlState";

const zDataFilterArray = z.array(zExperimentDataFilter);

interface UseUrlDataFiltersResult {
  filters: ExperimentDataFilter[];
  setFilters: (next: ExperimentDataFilter[]) => void;
  completeFilters: ExperimentDataFilter[];
}

/** URL-synced filter state, namespaced per table. */
export function useUrlDataFilters(tableName: string): UseUrlDataFiltersResult {
  const [filters, setFilters] = useUrlState<ExperimentDataFilter[]>({
    key: `f_${tableName}`,
    serialize: (next) => {
      const complete = next.filter((f) => zExperimentDataFilter.safeParse(f).success);
      return complete.length > 0 ? JSON.stringify(complete) : null;
    },
    parse: (raw) => {
      if (!raw) return [];
      const result = zDataFilterArray.safeParse(safeJsonParse(raw));
      return result.success ? result.data : [];
    },
  });

  const completeFilters = useMemo<ExperimentDataFilter[]>(
    () => filters.filter((f) => zExperimentDataFilter.safeParse(f).success),
    [filters],
  );

  return { filters, setFilters, completeFilters };
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
