"use client";

import { LayoutGrid, Palette } from "lucide-react";
import { useMemo } from "react";

import { filterColumnsForRole } from "@repo/api/domains/experiment/experiment-visualization-contracts";

import { ColorDimensionShelf } from "../../../../workspace/shelves/color/color-dimension-shelf";
import { FacetShelf } from "../../../../workspace/shelves/facet-shelf";
import { XAxisShelf } from "../../../../workspace/shelves/x-axis-shelf";
import { YAxisShelf } from "../../../../workspace/shelves/y-axis-shelf";
import { dataSourcesByRole, firstDataSourceByRole } from "../../../data/data-sources";
import { XAxisGlyph, YAxisGlyph } from "../../../shelf-axis-glyphs";
import type { ChartPanelProps, ShelfDef } from "../../../types";

const X_AXIS_NONE_INDEX = "INDEX";

function BoxPlotXShelf({ form, columns }: ChartPanelProps) {
  // X is optional; when picked it groups the boxes by category. Axis-type
  // is hidden because the box trace forces the categorical axis.
  const xColumns = useMemo(() => filterColumnsForRole(columns, "box-plot", "x"), [columns]);
  return <XAxisShelf form={form} columns={xColumns} hideAxisType allowNone />;
}

function BoxPlotYShelf({ form, columns }: ChartPanelProps) {
  // Aggregate dropdown hidden: the box trace computes the five-number
  // summary client-side from raw values.
  const yColumns = useMemo(() => filterColumnsForRole(columns, "box-plot", "y"), [columns]);
  return <YAxisShelf form={form} columns={yColumns} hideAxisType hideAggregate />;
}

function BoxPlotColorShelf({ form, columns, flat }: ChartPanelProps) {
  const colorColumns = useMemo(() => filterColumnsForRole(columns, "box-plot", "color"), [columns]);
  // Categorical-only: the renderer only does the categorical-pivot path
  // (one box per unique value), so a gradient over outliers has no meaning.
  return <ColorDimensionShelf form={form} columns={colorColumns} categoricalOnly flat={flat} />;
}

function BoxPlotFacetShelfWrapper({ form, columns, flat }: ChartPanelProps) {
  const facetColumns = useMemo(() => filterColumnsForRole(columns, "box-plot", "facet"), [columns]);
  return <FacetShelf form={form} columns={facetColumns} flat={flat} />;
}

export const boxPlotDataShelves: ShelfDef[] = [
  {
    key: "x",
    labelKey: "workspace.shelves.xAxis",
    icon: XAxisGlyph,
    Component: BoxPlotXShelf,
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
    Component: BoxPlotYShelf,
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
    Component: BoxPlotColorShelf,
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
    Component: BoxPlotFacetShelfWrapper,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "facet")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
];
