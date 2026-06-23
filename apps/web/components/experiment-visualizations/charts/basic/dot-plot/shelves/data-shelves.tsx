"use client";

import { Layers } from "lucide-react";
import { useMemo } from "react";

import { filterColumnsForRole } from "@repo/api/domains/experiment/experiment-visualization-contracts";

import { ColorDimensionShelf } from "../../../../workspace/shelves/color/color-dimension-shelf";
import { XAxisShelf } from "../../../../workspace/shelves/x-axis-shelf";
import { YAxisShelf } from "../../../../workspace/shelves/y-axis-shelf";
import { dataSourcesByRole, firstDataSourceByRole } from "../../../data/data-sources";
import { XAxisGlyph, YAxisGlyph } from "../../../shelf-axis-glyphs";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function DotPlotXShelf({ form, columns }: ChartPanelProps) {
  const xColumns = useMemo(() => filterColumnsForRole(columns, "dot-plot", "x"), [columns]);
  // Wrapper force-overrides the category axis to "category" in both
  // orientations, so the axis-type picker is misleading.
  return <XAxisShelf form={form} columns={xColumns} hideAxisType />;
}

function DotPlotYShelf({ form, columns }: ChartPanelProps) {
  const yColumns = useMemo(() => filterColumnsForRole(columns, "dot-plot", "y"), [columns]);
  return <YAxisShelf form={form} columns={yColumns} showErrorColumn />;
}

function DotPlotGroupShelf({ form, columns, flat }: ChartPanelProps) {
  // Hue equivalent: one dot per category per Y series per group value.
  const groupColumns = useMemo(() => filterColumnsForRole(columns, "dot-plot", "color"), [columns]);
  return <ColorDimensionShelf form={form} columns={groupColumns} categoricalOnly flat={flat} />;
}

export const dotPlotDataShelves: ShelfDef[] = [
  {
    key: "x",
    labelKey: "workspace.shelves.xAxis",
    icon: XAxisGlyph,
    Component: DotPlotXShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "x")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
  {
    key: "y",
    labelKey: "workspace.shelves.yAxis",
    icon: YAxisGlyph,
    Component: DotPlotYShelf,
    summary: (form, t) => {
      const sources = form.getValues("dataConfig.dataSources");
      const ys = dataSourcesByRole(sources, "y").filter(
        (entry) => entry.source.columnName && entry.source.columnName.length > 0,
      );
      if (ys.length === 0) return undefined;
      if (ys.length === 1) return ys[0]?.source.columnName;
      return t("workspace.shelves.seriesCount", { count: ys.length });
    },
  },
  {
    key: "groupBy",
    labelKey: "workspace.shelves.groupBy",
    icon: Layers,
    Component: DotPlotGroupShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "color")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
];
