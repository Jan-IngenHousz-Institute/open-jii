"use client";

import { useMemo } from "react";

import { filterColumnsForRole } from "@repo/api/domains/experiment/visualizations/experiment-visualization-role-rules";

import { XAxisShelf } from "../../../../workspace/shelves/x-axis-shelf";
import { YAxisShelf } from "../../../../workspace/shelves/y-axis-shelf";
import { firstDataSourceByRole } from "../../../data/data-sources";
import { XAxisGlyph, YAxisGlyph } from "../../../shelf-axis-glyphs";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function LollipopXShelf({ form, columns }: ChartPanelProps) {
  const xColumns = useMemo(() => filterColumnsForRole(columns, "lollipop", "x"), [columns]);
  // Renderer coerces categories to `String()`, so the wrapper always
  // forces axis type "category"; the X axis-type picker is misleading.
  return <XAxisShelf form={form} columns={xColumns} hideAxisType />;
}

function LollipopYShelf({ form, columns }: ChartPanelProps) {
  const yColumns = useMemo(() => filterColumnsForRole(columns, "lollipop", "y"), [columns]);
  // LollipopChart wrapper is single-series only; `maxSeries={1}` keeps the
  // shelf in sync with the role contract.
  return (
    <YAxisShelf
      form={form}
      columns={yColumns}
      maxSeries={1}
      showSeriesColor={false}
      showErrorColumn
    />
  );
}

export const lollipopDataShelves: ShelfDef[] = [
  {
    key: "x",
    labelKey: "workspace.shelves.xAxis",
    icon: XAxisGlyph,
    Component: LollipopXShelf,
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
    Component: LollipopYShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "y")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
];
