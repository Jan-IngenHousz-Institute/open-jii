"use client";

import { CircleDot, LayoutGrid, Palette } from "lucide-react";
import { useMemo } from "react";

import { filterColumnsForRole } from "@repo/api/utils/visualization-contracts";

import { ColorDimensionShelf } from "../../../../workspace/shelves/color/color-dimension-shelf";
import { FacetShelf } from "../../../../workspace/shelves/facet-shelf";
import { XAxisShelf } from "../../../../workspace/shelves/x-axis-shelf";
import { YAxisShelf } from "../../../../workspace/shelves/y-axis-shelf";
import { firstDataSourceByRole } from "../../../data/data-sources";
import { XAxisGlyph, YAxisGlyph } from "../../../shelf-axis-glyphs";
import type { ChartPanelProps, ShelfDef } from "../../../types";
import { BubbleSizeShelf } from "./size-shelf";

function BubbleXShelf({ form, columns }: ChartPanelProps) {
  const xColumns = useMemo(() => filterColumnsForRole(columns, "bubble", "x"), [columns]);
  return <XAxisShelf form={form} columns={xColumns} />;
}

function BubbleYShelf({ form, columns }: ChartPanelProps) {
  const yColumns = useMemo(() => filterColumnsForRole(columns, "bubble", "y"), [columns]);
  return (
    <YAxisShelf form={form} columns={yColumns} showCartesianControls defaultTraceType="scatter" />
  );
}

function BubbleSizeShelfWrapper({ form, columns }: ChartPanelProps) {
  const sizeColumns = useMemo(() => filterColumnsForRole(columns, "bubble", "size"), [columns]);
  // Size is a measure channel like Y; pairs column + aggregate so server-side
  // aggregation includes the size value in its projection.
  return <BubbleSizeShelf form={form} columns={sizeColumns} />;
}

function BubbleColorShelf({ form, columns, flat }: ChartPanelProps) {
  const colorColumns = useMemo(() => filterColumnsForRole(columns, "bubble", "color"), [columns]);
  return <ColorDimensionShelf form={form} columns={colorColumns} flat={flat} />;
}

function BubbleFacetShelfWrapper({ form, columns, flat }: ChartPanelProps) {
  const facetColumns = useMemo(() => filterColumnsForRole(columns, "bubble", "facet"), [columns]);
  return <FacetShelf form={form} columns={facetColumns} flat={flat} />;
}

export const bubbleDataShelves: ShelfDef[] = [
  {
    key: "x",
    labelKey: "workspace.shelves.xAxis",
    icon: XAxisGlyph,
    Component: BubbleXShelf,
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
    Component: BubbleYShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "y")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
  {
    key: "size",
    labelKey: "workspace.shelves.sizeDimension",
    icon: CircleDot,
    Component: BubbleSizeShelfWrapper,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "size")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
  {
    key: "color",
    labelKey: "workspace.shelves.colorDimension",
    icon: Palette,
    Component: BubbleColorShelf,
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
    Component: BubbleFacetShelfWrapper,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "facet")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
];
