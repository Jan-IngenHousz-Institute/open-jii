"use client";

import { useMemo } from "react";

import { filterColumnsForRole } from "@repo/api/domains/experiment/visualizations/experiment-visualization-contracts";

import { XAxisShelf } from "../../../../workspace/shelves/x-axis-shelf";
import { YAxisShelf } from "../../../../workspace/shelves/y-axis-shelf";
import { firstDataSourceByRole } from "../../../data/data-sources";
import { XAxisGlyph, YAxisGlyph } from "../../../shelf-axis-glyphs";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function DensityPlot2DXShelf({ form, columns }: ChartPanelProps) {
  // Aggregate / time-bucket hidden because the contour layer bins raw rows
  // client-side and the scatter layer needs the raw points; pre-aggregating
  // would erase both signals.
  const xColumns = useMemo(() => filterColumnsForRole(columns, "density-plot-2d", "x"), [columns]);
  return <XAxisShelf form={form} columns={xColumns} hideAxisType hideTimeBucket />;
}

function DensityPlot2DYShelf({ form, columns }: ChartPanelProps) {
  const yColumns = useMemo(() => filterColumnsForRole(columns, "density-plot-2d", "y"), [columns]);
  return (
    <YAxisShelf
      form={form}
      columns={yColumns}
      hideAxisType
      hideAggregate
      showSeriesColor={false}
      maxSeries={1}
    />
  );
}

export const densityPlot2DDataShelves: ShelfDef[] = [
  {
    key: "x",
    labelKey: "workspace.shelves.xAxis",
    icon: XAxisGlyph,
    Component: DensityPlot2DXShelf,
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
    Component: DensityPlot2DYShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "y")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
];
