"use client";

import { Compass, Sigma } from "lucide-react";
import { useMemo } from "react";

import { filterColumnsForRole } from "@repo/api/domains/experiment/experiment-visualization-contracts";
import { useTranslation } from "@repo/i18n";

import { SingleColumnShelf } from "../../../../workspace/shelves/single-column-shelf";
import { firstDataSourceByRole } from "../../../data/data-sources";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function WindRoseDirectionShelf({ form, columns }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const xColumns = useMemo(() => filterColumnsForRole(columns, "wind-rose", "x"), [columns]);
  return (
    <SingleColumnShelf
      form={form}
      columns={xColumns}
      role="x"
      heading={t("workspace.shelves.windRoseDirection")}
      columnLabel={t("workspace.shelves.column")}
      placeholder={t("workspace.shelves.selectColumn")}
    />
  );
}

function WindRoseMagnitudeShelf({ form, columns }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const yColumns = useMemo(() => filterColumnsForRole(columns, "wind-rose", "y"), [columns]);
  return (
    <SingleColumnShelf
      form={form}
      columns={yColumns}
      role="y"
      heading={t("workspace.shelves.windRoseMagnitude")}
      columnLabel={t("workspace.shelves.column")}
      placeholder={t("workspace.shelves.selectColumn")}
    />
  );
}

export const windRoseDataShelves: ShelfDef[] = [
  {
    key: "direction",
    labelKey: "workspace.shelves.windRoseDirection",
    icon: Compass,
    Component: WindRoseDirectionShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "x")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
  {
    key: "magnitude",
    labelKey: "workspace.shelves.windRoseMagnitude",
    icon: Sigma,
    Component: WindRoseMagnitudeShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "y")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
];
