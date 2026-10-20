"use client";

import { MapPin } from "lucide-react";

import type {
  ExperimentLayout,
  ExperimentUnit,
} from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { LayoutGridCell } from "./layout-grid-cell";
import { LayoutPlotSearch } from "./layout-plot-search";
import { rowLetter } from "./row-letter";

interface LayoutGridProps {
  layout: ExperimentLayout;
  selectedPlotId: string | null;
  onSelectPlot: (unit: ExperimentUnit) => void;
  /** Opens Anchor on map, offered only to those who can edit the layout. */
  onAnchor?: () => void;
}

function positionKey(row: number, column: number): string {
  return `${row}:${column}`;
}

export function LayoutGrid({ layout, selectedPlotId, onSelectPlot, onAnchor }: LayoutGridProps) {
  const { t } = useTranslation("experiments");

  const unitsByPosition = new Map<string, ExperimentUnit>();
  for (const unit of layout.units) {
    if (unit.row !== null && unit.column !== null) {
      unitsByPosition.set(positionKey(unit.row, unit.column), unit);
    }
  }

  const activeCount = layout.units.filter((unit) => unit.active).length;
  const gapCount = layout.rows * layout.columns - activeCount;
  const rowNumbers = Array.from({ length: layout.rows }, (_, index) => index + 1);
  const columnNumbers = Array.from({ length: layout.columns }, (_, index) => index + 1);

  const renderColumnHeader = (column: number) => (
    <div key={column} className="text-muted-foreground text-center text-xs">
      {column}
    </div>
  );

  const renderCell = (row: number, column: number) => {
    const unit = unitsByPosition.get(positionKey(row, column));
    return (
      <LayoutGridCell
        key={column}
        unit={unit}
        isSelected={unit !== undefined && unit.id === selectedPlotId}
        onSelect={onSelectPlot}
      />
    );
  };

  const renderRow = (row: number) => (
    <div key={row} className="contents">
      <div className="text-muted-foreground flex items-center text-xs font-medium">
        {rowLetter(row)}
      </div>
      {columnNumbers.map((column) => renderCell(row, column))}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("layout.gridTitle", { level: layout.levelName })}</CardTitle>
        <CardDescription>
          {t("layout.summary", { active: activeCount, gaps: gapCount })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LayoutPlotSearch units={layout.units} onFind={onSelectPlot} />
          {onAnchor === undefined ? null : (
            <Button type="button" variant="outline" onClick={onAnchor}>
              <MapPin className="size-4" aria-hidden />
              {t("layout.anchor.title")}
            </Button>
          )}
        </div>

        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `1.5rem repeat(${layout.columns}, minmax(2.5rem, 1fr))` }}
        >
          <div />
          {columnNumbers.map(renderColumnHeader)}
          {rowNumbers.map(renderRow)}
        </div>
      </CardContent>
    </Card>
  );
}
