"use client";

import { PaintBucket } from "lucide-react";
import { useState } from "react";

import type { ExperimentLayout } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { LayoutCount } from "./layout-count";
import { LayoutGapConfirm } from "./layout-gap-confirm";
import type { LayoutGridPosition } from "./layout-grid";
import { LayoutGrid } from "./layout-grid";
import { LayoutNamingScheme } from "./layout-naming";
import type { PlotCellKind } from "./plot-state";
import { PlotStateCell } from "./plot-state-cell";
import { PlotStateLegend } from "./plot-state-legend";
import { UnitName } from "./unit-name";

interface LayoutGapPainterProps {
  layout: ExperimentLayout;
  onDone: () => void;
}

function positionKey(row: number, column: number): string {
  return `${row}:${column}`;
}

/**
 * Mark gaps: a mode of the Plots view where clicking or dragging over positions turns plots into
 * gaps and gaps back into plots. A measured plot is never deleted; it becomes Removed.
 */
export function LayoutGapPainter({ layout, onDone }: LayoutGapPainterProps) {
  const { t } = useTranslation("experiments");
  const [painted, setPainted] = useState<ReadonlyMap<string, PlotCellKind>>(new Map());
  const [brush, setBrush] = useState<"gap" | "plot" | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const unitName = new UnitName(layout.levelName);
  const naming = new LayoutNamingScheme(
    layout.naming ?? "rowLetter",
    layout.columns,
    layout.firstNumber ?? 1,
  );

  const savedKind = ({ unit }: LayoutGridPosition): PlotCellKind => {
    if (unit === undefined) {
      return "gap";
    }
    if (unit.active) {
      return "plot";
    }
    return (unit.readingCount ?? 0) > 0 ? "removed" : "gap";
  };

  const kindAt = (position: LayoutGridPosition): PlotCellKind =>
    painted.get(positionKey(position.row, position.column)) ?? savedKind(position);

  const paintedKind = (position: LayoutGridPosition, target: "gap" | "plot"): PlotCellKind => {
    const isMeasured = (position.unit?.readingCount ?? 0) > 0;
    return target === "gap" && isMeasured ? "removed" : target;
  };

  const apply = (position: LayoutGridPosition, target: "gap" | "plot") => {
    const next = new Map(painted);
    next.set(positionKey(position.row, position.column), paintedKind(position, target));
    setPainted(next);
  };

  const startStroke = (position: LayoutGridPosition) => {
    const target = kindAt(position) === "plot" ? "gap" : "plot";
    setBrush(target);
    apply(position, target);
  };

  const continueStroke = (position: LayoutGridPosition) => {
    if (brush !== null) {
      apply(position, brush);
    }
  };

  const endStroke = () => {
    setBrush(null);
  };

  const unitsByPosition = new Map(
    layout.units.map((unit) => [positionKey(unit.row ?? 0, unit.column ?? 0), unit]),
  );
  const positions: LayoutGridPosition[] = Array.from(
    { length: layout.rows * layout.columns },
    (_, index) => {
      const row = Math.floor(index / layout.columns) + 1;
      const column = (index % layout.columns) + 1;
      return { row, column, unit: unitsByPosition.get(positionKey(row, column)) };
    },
  );

  const changed = positions.filter((position) => kindAt(position) !== savedKind(position));
  const removedNames = changed.flatMap((position) =>
    kindAt(position) === "removed" && position.unit !== undefined ? [position.unit.identifier] : [],
  );
  const plotCount = positions.filter((position) => kindAt(position) === "plot").length;
  const gapCount = positions.filter((position) => kindAt(position) === "gap").length;

  const closeConfirm = () => {
    setIsConfirming(false);
  };

  const finish = () => {
    if (removedNames.length > 0) {
      setIsConfirming(true);
      return;
    }
    onDone();
  };

  const renderCell = (position: LayoutGridPosition) => {
    const kind = kindAt(position);
    const identifier =
      position.unit?.identifier ?? naming.identifier(position.row, position.column);
    const handlePointerDown = () => {
      startStroke(position);
    };
    const handlePointerEnter = () => {
      continueStroke(position);
    };

    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={identifier}
        onPointerDown={handlePointerDown}
        onPointerEnter={handlePointerEnter}
        className="h-full w-full cursor-crosshair"
      >
        <PlotStateCell kind={kind} identifier={kind === "gap" ? undefined : identifier} />
      </div>
    );
  };

  const banner = (
    <div
      className="bg-primary/5 border-primary/30 flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2"
      data-gap-banner
    >
      <p className="flex items-center gap-2 text-sm">
        <PaintBucket className="text-primary size-4 shrink-0" aria-hidden />
        {t("layout.gaps.banner", { units: unitName.plural })}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm">
          {t("layout.gaps.changes", { count: changed.length })}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          {t("layout.gaps.cancel")}
        </Button>
        <Button type="button" size="sm" onClick={finish}>
          {t("layout.gaps.done")}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <LayoutGrid
        layout={layout}
        title={t("layout.gridTitle", { level: layout.levelName })}
        description={<LayoutCount levelName={layout.levelName} plots={plotCount} gaps={gapCount} />}
        renderCell={renderCell}
        banner={banner}
        onPointerUp={endStroke}
        footer={<PlotStateLegend entries={["gap", "removed"]} />}
      />
      <LayoutGapConfirm
        open={isConfirming}
        names={removedNames}
        levelName={layout.levelName}
        onCancel={closeConfirm}
        onConfirm={onDone}
      />
    </>
  );
}
