"use client";

import type {
  ExperimentLayout,
  ExperimentUnit,
} from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/card";

import { LayoutGridCell } from "./layout-grid-cell";
import { rowLetter } from "./row-letter";

interface LayoutGridProps {
  layout: ExperimentLayout;
}

function positionKey(row: number, column: number): string {
  return `${row}:${column}`;
}

export function LayoutGrid({ layout }: LayoutGridProps) {
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

  const renderRow = (row: number) => (
    <div key={row} className="contents">
      <div className="text-muted-foreground flex items-center text-xs font-medium">
        {rowLetter(row)}
      </div>
      {columnNumbers.map((column) => (
        <LayoutGridCell key={column} unit={unitsByPosition.get(positionKey(row, column))} />
      ))}
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
      <CardContent>
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
