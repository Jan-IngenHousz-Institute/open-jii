"use client";

import { useMemo } from "react";

import { filterColumnsForRole } from "@repo/api/domains/experiment/experiment-visualization-contracts";

import { XAxisShelf } from "../../../../workspace/shelves/x-axis-shelf";
import { YAxisShelf } from "../../../../workspace/shelves/y-axis-shelf";
import { firstDataSourceByRole } from "../../../data/data-sources";
import { XAxisGlyph, YAxisGlyph } from "../../../shelf-axis-glyphs";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function Histogram2DXShelf({ form, columns }: ChartPanelProps) {
  // Both axes hide aggregate / bucket / axis-type because Plotly bins the
  // raw row values directly; pre-aggregating would erase the signal.
  const xColumns = useMemo(() => filterColumnsForRole(columns, "histogram-2d", "x"), [columns]);
  return <XAxisShelf form={form} columns={xColumns} hideAxisType hideTimeBucket />;
}

function Histogram2DYShelf({ form, columns }: ChartPanelProps) {
  const yColumns = useMemo(() => filterColumnsForRole(columns, "histogram-2d", "y"), [columns]);
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

export const histogram2DDataShelves: ShelfDef[] = [
  {
    key: "x",
    labelKey: "workspace.shelves.xAxis",
    icon: XAxisGlyph,
    Component: Histogram2DXShelf,
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
    Component: Histogram2DYShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "y")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
];
