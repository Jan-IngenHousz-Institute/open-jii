"use client";

import { Palette, Variable } from "lucide-react";
import { useMemo } from "react";

import { filterColumnsForRole } from "@repo/api/utils/visualization-contracts";
import { useTranslation } from "@repo/i18n";

import { ColorDimensionShelf } from "../../../../workspace/shelves/color/color-dimension-shelf";
import { SingleColumnShelf } from "../../../../workspace/shelves/single-column-shelf";
import { firstDataSourceByRole } from "../../../data/data-sources";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function RidgeVariableShelf({ form, columns }: ChartPanelProps) {
  // Single-variable picker; role contract caps ridge at one value column.
  const { t } = useTranslation("experimentVisualizations");
  const yColumns = useMemo(() => filterColumnsForRole(columns, "ridge-plot", "y"), [columns]);
  return (
    <SingleColumnShelf
      form={form}
      columns={yColumns}
      role="y"
      heading={t("workspace.shelves.variable")}
      columnLabel={t("workspace.shelves.column")}
      placeholder={t("workspace.shelves.selectColumn")}
    />
  );
}

function RidgeColorShelf({ form, columns, flat }: ChartPanelProps) {
  // Color is the lane-defining grouping column, categorical only.
  const colorColumns = useMemo(
    () => filterColumnsForRole(columns, "ridge-plot", "color"),
    [columns],
  );
  return <ColorDimensionShelf form={form} columns={colorColumns} categoricalOnly flat={flat} />;
}

export const ridgePlotDataShelves: ShelfDef[] = [
  {
    key: "variable",
    labelKey: "workspace.shelves.variable",
    icon: Variable,
    Component: RidgeVariableShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "y")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
  {
    key: "color",
    labelKey: "workspace.shelves.colorDimension",
    icon: Palette,
    Component: RidgeColorShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "color")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
];
