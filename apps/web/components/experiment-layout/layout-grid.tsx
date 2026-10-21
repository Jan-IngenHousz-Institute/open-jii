"use client";

import type { ReactNode } from "react";

import type {
  ExperimentLayout,
  ExperimentUnit,
} from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";

import { rowLetter } from "./row-letter";

export interface LayoutGridPosition {
  row: number;
  column: number;
  unit: ExperimentUnit | undefined;
}

interface LayoutGridProps {
  layout: ExperimentLayout;
  title: string;
  description: ReactNode;
  renderCell: (position: LayoutGridPosition) => ReactNode;
  /** Controls above the grid, such as Find by name or Mark gaps. */
  toolbar?: ReactNode;
  /** Shown above the toolbar while a mode such as Mark gaps is on. */
  banner?: ReactNode;
  /** The legend and anything listed under the grid, such as plots without a position. */
  footer?: ReactNode;
  /** Ends a drag that started on a cell, wherever the pointer is released. */
  onPointerUp?: () => void;
  className?: string;
}

function positionKey(row: number, column: number): string {
  return `${row}:${column}`;
}

/**
 * The layout's rows and columns in their own scroll area, with the row letters and column numbers
 * kept in view while it scrolls.
 */
export function LayoutGrid({
  layout,
  title,
  description,
  renderCell,
  toolbar,
  banner,
  footer,
  onPointerUp,
  className,
}: LayoutGridProps) {
  const unitsByPosition = new Map<string, ExperimentUnit>();
  for (const unit of layout.units) {
    if (unit.row !== null && unit.column !== null) {
      unitsByPosition.set(positionKey(unit.row, unit.column), unit);
    }
  }

  const rowNumbers = Array.from({ length: layout.rows }, (_, index) => index + 1);
  const columnNumbers = Array.from({ length: layout.columns }, (_, index) => index + 1);

  const renderColumnHeader = (column: number) => (
    <div
      key={column}
      className="bg-card text-muted-foreground sticky top-0 z-10 pb-1 text-center text-xs"
    >
      {column}
    </div>
  );

  const renderPosition = (row: number, column: number) => (
    <div key={column} className="h-10">
      {renderCell({ row, column, unit: unitsByPosition.get(positionKey(row, column)) })}
    </div>
  );

  const renderRow = (row: number) => (
    <div key={row} className="contents">
      <div className="bg-card text-muted-foreground sticky left-0 z-10 flex items-center text-xs font-medium">
        {rowLetter(row)}
      </div>
      {columnNumbers.map((column) => renderPosition(row, column))}
    </div>
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {banner}
        {toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null}

        <div className="max-h-[70vh] overflow-auto">
          <div
            className={cn("grid select-none gap-1.5", onPointerUp && "touch-none")}
            style={{ gridTemplateColumns: `1.5rem repeat(${layout.columns}, minmax(2.5rem, 1fr))` }}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            <div className="bg-card sticky left-0 top-0 z-20" />
            {columnNumbers.map(renderColumnHeader)}
            {rowNumbers.map(renderRow)}
          </div>
        </div>

        {footer ? <div className="space-y-3 border-t pt-4">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}
