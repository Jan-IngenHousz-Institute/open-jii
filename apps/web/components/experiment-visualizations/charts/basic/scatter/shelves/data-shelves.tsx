"use client";

import { LayoutGrid, Palette } from "lucide-react";
import { useMemo } from "react";

import { filterColumnsForRole } from "@repo/api/domains/experiment/visualizations/experiment-visualization-contracts";

import { ColorDimensionShelf } from "../../../../workspace/shelves/color/color-dimension-shelf";
import { FacetShelf } from "../../../../workspace/shelves/facet-shelf";
import { XAxisShelf } from "../../../../workspace/shelves/x-axis-shelf";
import { YAxisShelf } from "../../../../workspace/shelves/y-axis-shelf";
import { dataSourcesByRole, firstDataSourceByRole } from "../../../data/data-sources";
import { XAxisGlyph, YAxisGlyph } from "../../../shelf-axis-glyphs";
import type { ChartPanelProps, ShelfDef } from "../../../types";

const X_AXIS_NONE_INDEX = "INDEX";

function ScatterXShelf({ form, columns }: ChartPanelProps) {
  const xColumns = useMemo(() => filterColumnsForRole(columns, "scatter", "x"), [columns]);
  return <XAxisShelf form={form} columns={xColumns} allowNone />;
}

function ScatterYShelf({ form, columns }: ChartPanelProps) {
  const yColumns = useMemo(() => filterColumnsForRole(columns, "scatter", "y"), [columns]);
  return (
    <YAxisShelf
      form={form}
      columns={yColumns}
      showCartesianControls
      defaultTraceType="scatter"
      showErrorColumn
    />
  );
}

function ScatterColorShelf({ form, columns, flat }: ChartPanelProps) {
  const colorColumns = useMemo(() => filterColumnsForRole(columns, "scatter", "color"), [columns]);
  return <ColorDimensionShelf form={form} columns={colorColumns} flat={flat} />;
}

function ScatterFacetShelfWrapper({ form, columns, flat }: ChartPanelProps) {
  const facetColumns = useMemo(() => filterColumnsForRole(columns, "scatter", "facet"), [columns]);
  return <FacetShelf form={form} columns={facetColumns} flat={flat} />;
}

export const scatterDataShelves: ShelfDef[] = [
  {
    key: "x",
    labelKey: "workspace.shelves.xAxis",
    icon: XAxisGlyph,
    Component: ScatterXShelf,
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
    Component: ScatterYShelf,
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
    key: "color",
    labelKey: "workspace.shelves.groupBy",
    icon: Palette,
    Component: ScatterColorShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "color")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
  {
    key: "facet",
    labelKey: "workspace.shelves.facetDimension",
    icon: LayoutGrid,
    Component: ScatterFacetShelfWrapper,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "facet")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
];
