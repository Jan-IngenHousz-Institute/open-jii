"use client";

import { useMemo } from "react";

import { filterColumnsForRole } from "@repo/api/domains/experiment/visualizations/experiment-visualization-role-rules";

import { XAxisShelf } from "../../../../workspace/shelves/x-axis-shelf";
import { YAxisShelf } from "../../../../workspace/shelves/y-axis-shelf";
import { firstDataSourceByRole } from "../../../data/data-sources";
import { XAxisGlyph, YAxisGlyph } from "../../../shelf-axis-glyphs";
import type { ChartPanelProps, ShelfDef } from "../../../types";

const X_AXIS_NONE_INDEX = "INDEX";

function SPCXShelf({ form, columns }: ChartPanelProps) {
  // SPC computes mean / sigma client-side from raw values; X bucketing
  // would collapse observations into bucket-means and erase the variance
  // SPC is computing.
  const xColumns = useMemo(
    () => filterColumnsForRole(columns, "spc-control-chart", "x"),
    [columns],
  );
  return <XAxisShelf form={form} columns={xColumns} hideTimeBucket allowNone />;
}

function SPCYShelf({ form, columns }: ChartPanelProps) {
  // Single Y series only; multi-series SPC overlays are confusing.
  const yColumns = useMemo(
    () => filterColumnsForRole(columns, "spc-control-chart", "y"),
    [columns],
  );
  return (
    <YAxisShelf
      form={form}
      columns={yColumns}
      maxSeries={1}
      showSeriesColor={false}
      hideAggregate
    />
  );
}

export const spcControlChartDataShelves: ShelfDef[] = [
  {
    key: "x",
    labelKey: "workspace.shelves.xAxis",
    icon: XAxisGlyph,
    Component: SPCXShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const x = firstDataSourceByRole(sources, "x");
      const col = x?.source.columnName;
      return col && col.length > 0 ? col : X_AXIS_NONE_INDEX;
    },
  },
  {
    key: "y",
    labelKey: "workspace.shelves.yAxis",
    icon: YAxisGlyph,
    Component: SPCYShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "y")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
];
