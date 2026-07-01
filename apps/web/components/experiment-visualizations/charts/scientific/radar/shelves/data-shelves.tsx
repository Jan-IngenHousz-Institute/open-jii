"use client";

import { Palette, Radar } from "lucide-react";
import { useMemo } from "react";

import { filterColumnsForRole } from "@repo/api/domains/experiment/visualizations/experiment-visualization-contracts";
import { useTranslation } from "@repo/i18n";

import { ColorDimensionShelf } from "../../../../workspace/shelves/color/color-dimension-shelf";
import { MultiColumnShelf } from "../../../../workspace/shelves/multi-column-shelf";
import { dataSourcesByRole, firstDataSourceByRole } from "../../../data/data-sources";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function RadarAxesShelf({ form, columns }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const yColumns = useMemo(() => filterColumnsForRole(columns, "radar", "y"), [columns]);
  return (
    <MultiColumnShelf
      form={form}
      columns={yColumns}
      role="y"
      heading={t("workspace.shelves.radarAxes")}
      columnLabel={t("workspace.shelves.column")}
      placeholder={t("workspace.shelves.selectColumn")}
      // Radar needs >= 3 axes to render as a polygon; the shelf hides the
      // trash icon at the floor.
      minSeries={3}
    />
  );
}

function RadarColorShelf({ form, columns, flat }: ChartPanelProps) {
  const colorColumns = useMemo(() => filterColumnsForRole(columns, "radar", "color"), [columns]);
  return <ColorDimensionShelf form={form} columns={colorColumns} categoricalOnly flat={flat} />;
}

export const radarDataShelves: ShelfDef[] = [
  {
    key: "axes",
    labelKey: "workspace.shelves.radarAxes",
    icon: Radar,
    Component: RadarAxesShelf,
    summary: (form, t) => {
      const sources = form.getValues("dataConfig.dataSources");
      const ys = dataSourcesByRole(sources, "y").filter(
        (entry) => entry.source.columnName && entry.source.columnName.length > 0,
      );
      if (ys.length === 0) return undefined;
      if (ys.length === 1) return ys[0]?.source.columnName;
      return t("workspace.shelves.axesCount", { count: ys.length });
    },
  },
  {
    key: "color",
    labelKey: "workspace.shelves.groupBy",
    icon: Palette,
    Component: RadarColorShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "color")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
];
