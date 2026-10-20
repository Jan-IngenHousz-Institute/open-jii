import type { ReactNode } from "react";

import type {
  ExperimentLayout,
  ExperimentUnit,
} from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { cn } from "@repo/ui/lib/utils";

import { rowLetter } from "../row-letter";

interface SessionGridProps {
  layout: ExperimentLayout;
  renderCell: (unit: ExperimentUnit | undefined, row: number, column: number) => ReactNode;
  /** Drawn over the cells in grid units, one unit per cell, so a point at (2.5, 0.5) is a center. */
  overlay?: ReactNode;
  isCompact?: boolean;
  onPointerUp?: () => void;
}

function positionKey(row: number, column: number): string {
  return `${row}:${column}`;
}

/**
 * The layout grid, laid out without gaps between tracks so each cell is exactly one grid unit and
 * an overlay can draw through cell centers. Cells pad themselves to keep the gutters.
 */
export function SessionGrid({
  layout,
  renderCell,
  overlay,
  isCompact = false,
  onPointerUp,
}: SessionGridProps) {
  const unitsByPosition = new Map<string, ExperimentUnit>();
  for (const unit of layout.units) {
    if (unit.row !== null && unit.column !== null) {
      unitsByPosition.set(positionKey(unit.row, unit.column), unit);
    }
  }

  const rowNumbers = Array.from({ length: layout.rows }, (_, index) => index + 1);
  const columnNumbers = Array.from({ length: layout.columns }, (_, index) => index + 1);
  const columnTemplate = `repeat(${layout.columns}, minmax(${isCompact ? "1.75rem" : "2.5rem"}, 1fr))`;
  const rowHeight = isCompact ? "1.75rem" : "2.75rem";

  const renderColumnHeader = (column: number) => (
    <div key={column} className="text-muted-foreground text-center text-xs">
      {column}
    </div>
  );

  const renderRowLetter = (row: number) => (
    <div key={row} className="text-muted-foreground flex items-center text-xs font-medium">
      {rowLetter(row)}
    </div>
  );

  const renderRow = (row: number) =>
    columnNumbers.map((column) => (
      <div key={positionKey(row, column)} className="p-[3px]">
        {renderCell(unitsByPosition.get(positionKey(row, column)), row, column)}
      </div>
    ));

  return (
    <div
      className={cn("grid gap-x-1.5", isCompact ? "gap-y-1" : "gap-y-1.5")}
      style={{ gridTemplateColumns: "1.5rem 1fr" }}
    >
      <div />
      <div className="grid" style={{ gridTemplateColumns: columnTemplate }}>
        {columnNumbers.map(renderColumnHeader)}
      </div>
      <div className="grid" style={{ gridAutoRows: rowHeight }}>
        {rowNumbers.map(renderRowLetter)}
      </div>
      <div
        className="relative grid touch-none select-none"
        style={{ gridTemplateColumns: columnTemplate, gridAutoRows: rowHeight }}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {rowNumbers.map(renderRow)}
        {overlay ? (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox={`0 0 ${layout.columns} ${layout.rows}`}
            preserveAspectRatio="none"
            aria-hidden
          >
            {overlay}
          </svg>
        ) : null}
      </div>
    </div>
  );
}
