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
