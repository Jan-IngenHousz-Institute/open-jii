"use client";

import { useMemo } from "react";
import { z } from "zod";

import type { DataFilter } from "@repo/api/schemas/experiment.schema";
import { zDataFilter } from "@repo/api/schemas/experiment.schema";

import { useUrlState } from "./useUrlState";

const zDataFilterArray = z.array(zDataFilter);

interface UseUrlDataFiltersResult {
  filters: DataFilter[];
  setFilters: (next: DataFilter[]) => void;
  completeFilters: DataFilter[];
}

/** URL-synced filter state, namespaced per table. */
export function useUrlDataFilters(tableName: string): UseUrlDataFiltersResult {
  const [filters, setFilters] = useUrlState<DataFilter[]>({
    key: `f_${tableName}`,
    serialize: (next) => {
      const complete = next.filter((f) => zDataFilter.safeParse(f).success);
      return complete.length > 0 ? JSON.stringify(complete) : null;
    },
    parse: (raw) => {
      if (!raw) return [];
      const result = zDataFilterArray.safeParse(safeJsonParse(raw));
      return result.success ? result.data : [];
    },
  });

  const completeFilters = useMemo<DataFilter[]>(
    () => filters.filter((f) => zDataFilter.safeParse(f).success),
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
