"use client";

import { LayoutGrid, Palette, Variable } from "lucide-react";
import { useMemo } from "react";

import { filterColumnsForRole } from "@repo/api/domains/experiment/visualizations/experiment-visualization-contracts";
import { useTranslation } from "@repo/i18n";

import { ColorDimensionShelf } from "../../../../workspace/shelves/color/color-dimension-shelf";
import { FacetShelf } from "../../../../workspace/shelves/facet-shelf";
import { MultiColumnShelf } from "../../../../workspace/shelves/multi-column-shelf";
import { dataSourcesByRole, firstDataSourceByRole } from "../../../data/data-sources";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function DensityVariablesShelf({ form, columns }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  // Density plot visualises distribution via KDE; no X axis to map onto.
  // Same shelf framing as histogram and violin.
  const yColumns = useMemo(() => filterColumnsForRole(columns, "density-plot", "y"), [columns]);
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

function DensityColorShelf({ form, columns, flat }: ChartPanelProps) {
  const colorColumns = useMemo(
    () => filterColumnsForRole(columns, "density-plot", "color"),
    [columns],
  );
  // Categorical-only (same as histogram/violin); one curve per unique value.
  return <ColorDimensionShelf form={form} columns={colorColumns} categoricalOnly flat={flat} />;
}

function DensityFacetShelfWrapper({ form, columns, flat }: ChartPanelProps) {
  const facetColumns = useMemo(
    () => filterColumnsForRole(columns, "density-plot", "facet"),
    [columns],
  );
  return <FacetShelf form={form} columns={facetColumns} flat={flat} />;
}

export const densityPlotDataShelves: ShelfDef[] = [
  {
    key: "variables",
    labelKey: "workspace.shelves.variables",
    icon: Variable,
    Component: DensityVariablesShelf,
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
    labelKey: "workspace.shelves.groupBy",
    icon: Palette,
    Component: DensityColorShelf,
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
    Component: DensityFacetShelfWrapper,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "facet")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
];
