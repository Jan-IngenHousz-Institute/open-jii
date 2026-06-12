"use client";

import { LayoutGrid, Palette, Variable } from "lucide-react";
import { useMemo } from "react";

import { filterColumnsForRole } from "@repo/api/utils/visualization-contracts";
import { useTranslation } from "@repo/i18n";

import { ColorDimensionShelf } from "../../../../workspace/shelves/color/color-dimension-shelf";
import { FacetShelf } from "../../../../workspace/shelves/facet-shelf";
import { MultiColumnShelf } from "../../../../workspace/shelves/multi-column-shelf";
import { XAxisShelf } from "../../../../workspace/shelves/x-axis-shelf";
import { dataSourcesByRole, firstDataSourceByRole } from "../../../data/data-sources";
import { XAxisGlyph } from "../../../shelf-axis-glyphs";
import type { ChartPanelProps, ShelfDef } from "../../../types";

const X_AXIS_NONE_INDEX = "INDEX";

function ViolinXShelf({ form, columns }: ChartPanelProps) {
  // Violin's X shelf is a real (optional) categorical axis when set.
  const xColumns = useMemo(() => filterColumnsForRole(columns, "violin-plot", "x"), [columns]);
  return <XAxisShelf form={form} columns={xColumns} hideAxisType allowNone />;
}

function ViolinVariablesShelf({ form, columns }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  // The value-column shelf is the "Variable(s)" picker shared with
  // histogram / density / ridge.
  const yColumns = useMemo(() => filterColumnsForRole(columns, "violin-plot", "y"), [columns]);
  return (
    <MultiColumnShelf
      form={form}
      columns={yColumns}
      role="y"
      heading={t("workspace.shelves.variables")}
      columnLabel={t("workspace.shelves.column")}
      placeholder={t("workspace.shelves.selectColumn")}
      showAlias
      showSeriesColor
    />
  );
}

function ViolinColorShelf({ form, columns, flat }: ChartPanelProps) {
  const colorColumns = useMemo(
    () => filterColumnsForRole(columns, "violin-plot", "color"),
    [columns],
  );
  // Categorical-only (same as box-plot/histogram); the renderer only
  // does the categorical-pivot path.
  return <ColorDimensionShelf form={form} columns={colorColumns} categoricalOnly flat={flat} />;
}

function ViolinFacetShelfWrapper({ form, columns, flat }: ChartPanelProps) {
  const facetColumns = useMemo(
    () => filterColumnsForRole(columns, "violin-plot", "facet"),
    [columns],
  );
  return <FacetShelf form={form} columns={facetColumns} flat={flat} />;
}

export const violinPlotDataShelves: ShelfDef[] = [
  {
    key: "x",
    labelKey: "workspace.shelves.xAxis",
    icon: XAxisGlyph,
    Component: ViolinXShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const x = firstDataSourceByRole(sources, "x");
      const col = x?.source.columnName;
      return col && col.length > 0 ? col : X_AXIS_NONE_INDEX;
    },
  },
  {
    key: "variables",
    labelKey: "workspace.shelves.variables",
    icon: Variable,
    Component: ViolinVariablesShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const ys = dataSourcesByRole(sources, "y").filter(
        (entry) => entry.source.columnName && entry.source.columnName.length > 0,
      );
      if (ys.length === 0) return undefined;
      if (ys.length === 1) return ys[0]?.source.columnName;
      return `${ys.length} variables`;
    },
  },
  {
    key: "color",
    labelKey: "workspace.shelves.colorDimension",
    icon: Palette,
    Component: ViolinColorShelf,
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
    Component: ViolinFacetShelfWrapper,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "facet")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
];
