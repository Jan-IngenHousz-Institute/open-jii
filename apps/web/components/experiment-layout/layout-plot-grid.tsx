"use client";

import { MapPin, PaintBucket, Table2 } from "lucide-react";
import type { ReactNode } from "react";

import type {
  ExperimentLayout,
  ExperimentUnit,
} from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { LayoutCount } from "./layout-count";
import type { LayoutGridPosition } from "./layout-grid";
import { LayoutGrid } from "./layout-grid";
import { LayoutGridCell } from "./layout-grid-cell";
import { LayoutOccupancy } from "./layout-occupancy";
import { LayoutPlotSearch } from "./layout-plot-search";
import { LayoutUnplacedStrip } from "./layout-unplaced-strip";
import type { PlotCategories, PlotLegendEntry } from "./plot-state";
import { PlotStateLegend } from "./plot-state-legend";

export interface LayoutPlotGridActions {
  onMarkGaps?: () => void;
  onAnchor?: () => void;
  onAddAttributes?: () => void;
}

interface LayoutPlotGridProps {
  layout: ExperimentLayout;
  selectedPlotId: string | null;
  onSelectPlot: (unit: ExperimentUnit) => void;
  /** Offered only to those who can edit the layout. */
  actions: LayoutPlotGridActions;
  /** What the fill encodes, from Color by. Neutral when absent. */
  coloring?: {
    name: string;
    categories: PlotCategories;
    valueOf: (unit: ExperimentUnit) => string | undefined;
  };
  /** Color by, which sits in the toolbar once plots carry attributes. */
  colorBy?: ReactNode;
}

/** The Plots view's grid in its default mode, where clicking a plot opens its panel. */
export function LayoutPlotGrid({
  layout,
  selectedPlotId,
  onSelectPlot,
  actions,
  coloring,
  colorBy,
}: LayoutPlotGridProps) {
  const { t } = useTranslation("experiments");

  const occupancy = new LayoutOccupancy(layout);
  const hasRemoved = layout.units.some((unit) => !unit.active && (unit.readingCount ?? 0) > 0);
  const legendEntries: PlotLegendEntry[] = hasRemoved ? ["gap", "removed"] : ["gap"];

  const renderCell = ({ unit }: LayoutGridPosition) => (
    <LayoutGridCell
      unit={unit}
      category={unit === undefined ? undefined : coloring?.categories.get(coloring.valueOf(unit))}
      isSelected={unit?.id === selectedPlotId}
      onSelect={onSelectPlot}
    />
  );

  const toolbar = (
    <>
      <LayoutPlotSearch units={layout.units} levelName={layout.levelName} onFind={onSelectPlot} />
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {colorBy}
        {actions.onAddAttributes ? (
          <Button type="button" variant="outline" onClick={actions.onAddAttributes}>
            <Table2 className="size-4" aria-hidden />
            {t("layout.addAttributes")}
          </Button>
        ) : null}
        {actions.onMarkGaps ? (
          <Button type="button" variant="outline" onClick={actions.onMarkGaps}>
            <PaintBucket className="size-4" aria-hidden />
            {t("layout.gaps.mark")}
          </Button>
        ) : null}
        {actions.onAnchor ? (
          <Button type="button" variant="outline" onClick={actions.onAnchor}>
            <MapPin className="size-4" aria-hidden />
            {t("layout.anchor.title")}
          </Button>
        ) : null}
      </div>
    </>
  );

  const footer = (
    <>
      <LayoutUnplacedStrip
        units={layout.units}
        levelName={layout.levelName}
        selectedPlotId={selectedPlotId}
        onSelect={onSelectPlot}
      />
      <PlotStateLegend
        categoryName={coloring?.name}
        categories={coloring?.categories}
        entries={legendEntries}
      />
    </>
  );

  return (
    <LayoutGrid
      layout={layout}
      title={t("layout.gridTitle", { level: layout.levelName })}
      description={
        <LayoutCount
          levelName={layout.levelName}
          plots={occupancy.plotCount}
          gaps={occupancy.gapCount}
        />
      }
      renderCell={renderCell}
      toolbar={toolbar}
      footer={footer}
    />
  );
}
