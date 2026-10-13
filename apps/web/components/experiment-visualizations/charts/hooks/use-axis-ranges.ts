"use client";

import { useCallback, useState } from "react";

import { rangesAfterRelayout } from "../cartesian/relayout-ranges";
import type { AxisRanges } from "../cartesian/relayout-ranges";

/**
 * The x range each axis of a chart shows, following the user's zooms, pans and resets; one range
 * for all cells when they share their x.
 */
export function useAxisRanges(isSharedX = false): {
  ranges: AxisRanges;
  onRelayout: (event: Readonly<Record<string, unknown>>) => void;
} {
  const [ranges, setRanges] = useState<AxisRanges>({});
  const onRelayout = useCallback(
    (event: Readonly<Record<string, unknown>>) =>
      setRanges((current) => rangesAfterRelayout(current, event, isSharedX)),
    [isSharedX],
  );
  return { ranges, onRelayout };
}
