"use client";

import { Layers, LayoutGrid } from "lucide-react";
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

function AreaXShelf({ form, columns }: ChartPanelProps) {
  const xColumns = useMemo(() => filterColumnsForRole(columns, "area", "x"), [columns]);
  return <XAxisShelf form={form} columns={xColumns} allowNone />;
}

function AreaYShelf({ form, columns }: ChartPanelProps) {
  const yColumns = useMemo(() => filterColumnsForRole(columns, "area", "y"), [columns]);
  return (
    <YAxisShelf
      form={form}
      columns={yColumns}
      showCartesianControls
      defaultTraceType="area"
      showErrorColumn
    />
  );
}

function AreaGroupShelf({ form, columns, flat }: ChartPanelProps) {
  // Color follows from categorical splitting on area charts, surfaced
  // as Group by because the gradient encoding doesn't apply here.
  const groupColumns = useMemo(() => filterColumnsForRole(columns, "area", "color"), [columns]);
  return <ColorDimensionShelf form={form} columns={groupColumns} categoricalOnly flat={flat} />;
}

function AreaFacetShelfWrapper({ form, columns, flat }: ChartPanelProps) {
  const facetColumns = useMemo(() => filterColumnsForRole(columns, "area", "facet"), [columns]);
  return <FacetShelf form={form} columns={facetColumns} flat={flat} />;
}

export const areaDataShelves: ShelfDef[] = [
  {
    key: "x",
    labelKey: "workspace.shelves.xAxis",
    icon: XAxisGlyph,
    Component: AreaXShelf,
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
    Component: AreaYShelf,
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
    Component: AreaGroupShelf,
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
    Component: AreaFacetShelfWrapper,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "facet")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
];
