"use client";

import { AlignVerticalJustifyCenter, Palette } from "lucide-react";
import { useMemo } from "react";

import { filterColumnsForRole } from "@repo/api/utils/visualization-contracts";
import { useTranslation } from "@repo/i18n";

import { ColorDimensionShelf } from "../../../../workspace/shelves/color/color-dimension-shelf";
import { MultiColumnShelf } from "../../../../workspace/shelves/multi-column-shelf";
import { dataSourcesByRole, firstDataSourceByRole } from "../../../data/data-sources";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function ParcoordsAxesShelf({ form, columns }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const yColumns = useMemo(
    () => filterColumnsForRole(columns, "parallel-coordinates", "y"),
    [columns],
  );
  return (
    <MultiColumnShelf
      form={form}
      columns={yColumns}
      role="y"
      heading={t("workspace.shelves.parcoordsAxes")}
      columnLabel={t("workspace.shelves.column")}
      placeholder={t("workspace.shelves.selectColumn")}
    />
  );
}

function ParcoordsColorShelf({ form, columns, flat }: ChartPanelProps) {
  const colorColumns = useMemo(
    () => filterColumnsForRole(columns, "parallel-coordinates", "color"),
    [columns],
  );
  return <ColorDimensionShelf form={form} columns={colorColumns} flat={flat} />;
}

export const parallelCoordinatesDataShelves: ShelfDef[] = [
  {
    key: "axes",
    labelKey: "workspace.shelves.parcoordsAxes",
    icon: AlignVerticalJustifyCenter,
    Component: ParcoordsAxesShelf,
    summary: (form, t) => {
      const sources = form.getValues("dataConfig.dataSources");
      const uniqueColumns = Array.from(
        new Set(
          dataSourcesByRole(sources, "y")
            .map((entry) => entry.source.columnName)
            .filter((c): c is string => typeof c === "string" && c.length > 0),
        ),
      );
      if (uniqueColumns.length === 0) return undefined;
      if (uniqueColumns.length === 1) return uniqueColumns[0];
      return t("workspace.shelves.axesCount", { count: uniqueColumns.length });
    },
  },
  {
    key: "color",
    labelKey: "workspace.shelves.groupBy",
    icon: Palette,
    Component: ParcoordsColorShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "color")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
];
