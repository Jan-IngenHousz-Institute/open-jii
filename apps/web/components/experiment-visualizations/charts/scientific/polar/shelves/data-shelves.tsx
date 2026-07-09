"use client";

import { Compass, Palette, RotateCw } from "lucide-react";
import { useMemo } from "react";

import { filterColumnsForRole } from "@repo/api/utils/visualization-contracts";
import { useTranslation } from "@repo/i18n";

import { ColorDimensionShelf } from "../../../../workspace/shelves/color/color-dimension-shelf";
import { MultiColumnShelf } from "../../../../workspace/shelves/multi-column-shelf";
import { SingleColumnShelf } from "../../../../workspace/shelves/single-column-shelf";
import { dataSourcesByRole, firstDataSourceByRole } from "../../../data/data-sources";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function PolarThetaShelf({ form, columns }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const xColumns = useMemo(() => filterColumnsForRole(columns, "polar", "x"), [columns]);
  return (
    <SingleColumnShelf
      form={form}
      columns={xColumns}
      role="x"
      heading={t("workspace.shelves.polarTheta")}
      columnLabel={t("workspace.shelves.column")}
      placeholder={t("workspace.shelves.selectColumn")}
    />
  );
}

function PolarRadialShelf({ form, columns }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const yColumns = useMemo(() => filterColumnsForRole(columns, "polar", "y"), [columns]);
  return (
    <MultiColumnShelf
      form={form}
      columns={yColumns}
      role="y"
      heading={t("workspace.shelves.polarRadial")}
      columnLabel={t("workspace.shelves.column")}
      placeholder={t("workspace.shelves.selectColumn")}
    />
  );
}

function PolarColorShelf({ form, columns, flat }: ChartPanelProps) {
  const colorColumns = useMemo(() => filterColumnsForRole(columns, "polar", "color"), [columns]);
  return <ColorDimensionShelf form={form} columns={colorColumns} flat={flat} />;
}

export const polarDataShelves: ShelfDef[] = [
  {
    key: "theta",
    labelKey: "workspace.shelves.polarTheta",
    icon: RotateCw,
    Component: PolarThetaShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "x")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
  {
    key: "radial",
    labelKey: "workspace.shelves.polarRadial",
    icon: Compass,
    Component: PolarRadialShelf,
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
    Component: PolarColorShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "color")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
];
