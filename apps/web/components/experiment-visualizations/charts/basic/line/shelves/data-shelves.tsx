"use client";

import { Layers, LayoutGrid } from "lucide-react";
import { useMemo } from "react";

import { filterColumnsForRole } from "@repo/api/utils/visualization-contracts";

import { FacetShelf } from "../../../../workspace/shelves/facet-shelf";
import { GroupByShelf } from "../../../../workspace/shelves/group-by-shelf";
import { XAxisShelf } from "../../../../workspace/shelves/x-axis-shelf";
import { YAxisShelf } from "../../../../workspace/shelves/y-axis-shelf";
import { dataSourcesByRole, firstDataSourceByRole } from "../../../data/data-sources";
import { XAxisGlyph, YAxisGlyph } from "../../../shelf-axis-glyphs";
import type { ChartPanelProps, ShelfDef } from "../../../types";

const X_AXIS_NONE_INDEX = "INDEX";

function LineXShelf({ form, columns }: ChartPanelProps) {
  const xColumns = useMemo(() => filterColumnsForRole(columns, "line", "x"), [columns]);
  return <XAxisShelf form={form} columns={xColumns} allowNone />;
}

function LineYShelf({ form, columns }: ChartPanelProps) {
  const yColumns = useMemo(() => filterColumnsForRole(columns, "line", "y"), [columns]);
  return (
    <YAxisShelf
      form={form}
      columns={yColumns}
      showCartesianControls
      defaultTraceType="line"
      showErrorColumn
    />
  );
}

function LineGroupShelf({ form, columns, flat }: ChartPanelProps) {
  // Same `role: "color"` columns scatter uses; the GroupByShelf surfaces
  // them with the right verbiage (and a focused UI) for line.
  const groupColumns = useMemo(() => filterColumnsForRole(columns, "line", "color"), [columns]);
  return <GroupByShelf form={form} columns={groupColumns} flat={flat} />;
}

function LineFacetShelfWrapper({ form, columns, flat }: ChartPanelProps) {
  const facetColumns = useMemo(() => filterColumnsForRole(columns, "line", "facet"), [columns]);
  return <FacetShelf form={form} columns={facetColumns} flat={flat} />;
}

export const lineDataShelves: ShelfDef[] = [
  {
    key: "x",
    labelKey: "workspace.shelves.xAxis",
    icon: XAxisGlyph,
    Component: LineXShelf,
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
    Component: LineYShelf,
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
    Component: LineGroupShelf,
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
    Component: LineFacetShelfWrapper,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "facet")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
];
