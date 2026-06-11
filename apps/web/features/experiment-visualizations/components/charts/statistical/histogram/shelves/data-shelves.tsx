"use client";

import { LayoutGrid, Palette, Variable } from "lucide-react";
import { useMemo } from "react";

import { filterColumnsForRole } from "@repo/api/utils/visualization-contracts";
import { useTranslation } from "@repo/i18n";

import { ColorDimensionShelf } from "../../../../workspace/shelves/color/color-dimension-shelf";
import { FacetShelf } from "../../../../workspace/shelves/facet-shelf";
import { MultiColumnShelf } from "../../../../workspace/shelves/multi-column-shelf";
import { dataSourcesByRole, firstDataSourceByRole } from "../../../data/data-sources";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function HistogramVariablesShelf({ form, columns }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  // Histogram visualises the *distribution* of one or more variables by
  // binning their values; no X axis to map columns onto, so we frame the
  // shelf as "variables" (same as density and violin).
  const yColumns = useMemo(() => filterColumnsForRole(columns, "histogram", "y"), [columns]);
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

function HistogramColorShelf({ form, columns, flat }: ChartPanelProps) {
  const colorColumns = useMemo(
    () => filterColumnsForRole(columns, "histogram", "color"),
    [columns],
  );
  // Categorical-only: the renderer only does the categorical split path
  // (one trace per unique value); a gradient on bin counts is meaningless.
  return <ColorDimensionShelf form={form} columns={colorColumns} categoricalOnly flat={flat} />;
}

function HistogramFacetShelfWrapper({ form, columns, flat }: ChartPanelProps) {
  const facetColumns = useMemo(
    () => filterColumnsForRole(columns, "histogram", "facet"),
    [columns],
  );
  return <FacetShelf form={form} columns={facetColumns} flat={flat} />;
}

export const histogramDataShelves: ShelfDef[] = [
  {
    key: "variables",
    labelKey: "workspace.shelves.variables",
    icon: Variable,
    Component: HistogramVariablesShelf,
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
    Component: HistogramColorShelf,
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
    Component: HistogramFacetShelfWrapper,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "facet")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
];
