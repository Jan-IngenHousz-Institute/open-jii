import { useState } from "react";

import type { ExperimentDataFilter } from "@repo/api/domains/experiment/data/experiment-data.schema";

/** Stable per-filter keys so popover state survives neighbour add/remove. */
export function useStableFilterKeys(filters: ExperimentDataFilter[]): string[] {
  const [state, setState] = useState<{ filters: ExperimentDataFilter[]; keys: string[] }>({
    filters: [],
    keys: [],
  });

  if (filters !== state.filters) {
    let nextKeys: string[];
    if (filters.length === state.filters.length) {
      nextKeys = state.keys;
    } else {
      nextKeys = filters.map((f) => {
        const idx = state.filters.indexOf(f);
        return idx >= 0 ? state.keys[idx] : crypto.randomUUID();
      });
    }
    setState({ filters, keys: nextKeys });
    // Return fresh keys so the current render gets stable identity before commit.
    return nextKeys;
  }
  return state.keys;
}
