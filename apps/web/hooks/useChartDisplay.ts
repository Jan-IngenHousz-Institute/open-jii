import { useCallback, useState } from "react";
import type { OnChartClickHandler } from "~/components/data-table/data-table-columns";

export interface ChartDisplayState {
  data: number[];
  columnName: string;
  rowId: string;
  isPinned: boolean;
}

/**
 * Pin/unpin logic for the experiment data table's trace chart. A click
 * unpins only when it repeats the currently pinned row+column; any other
 * click (a different row, even in the same column) pins the new trace.
 */
export function toggleChartDisplay(
  prev: ChartDisplayState | null,
  data: number[],
  columnName: string,
  rowId: string,
): ChartDisplayState | null {
  if (prev?.isPinned && prev.columnName === columnName && prev.rowId === rowId) {
    return null;
  }
  return { data, columnName, rowId, isPinned: true };
}

export function useChartDisplay() {
  const [chartDisplay, setChartDisplay] = useState<ChartDisplayState | null>(null);

  const toggleChartPin = useCallback<OnChartClickHandler>((data, columnName, rowId) => {
    setChartDisplay((prev) => toggleChartDisplay(prev, data, columnName, rowId));
  }, []);

  const closePinnedChart = useCallback(() => {
    setChartDisplay(null);
  }, []);

  return { chartDisplay, toggleChartPin, closePinnedChart };
}
