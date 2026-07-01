"use client";

import { Layers, Sigma } from "lucide-react";
import { useMemo } from "react";

import { filterColumnsForRole } from "@repo/api/domains/experiment/visualizations/experiment-visualization-contracts";
import { useTranslation } from "@repo/i18n";

import { MultiColumnShelf } from "../../../../workspace/shelves/multi-column-shelf";
import { SingleColumnShelf } from "../../../../workspace/shelves/single-column-shelf";
import { dataSourcesByRole, firstDataSourceByRole } from "../../../data/data-sources";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function AlluvialStagesShelf({ form, columns }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const stageColumns = useMemo(
    () => filterColumnsForRole(columns, "alluvial", "groupBy"),
    [columns],
  );
  return (
    <MultiColumnShelf
      form={form}
      columns={stageColumns}
      role="groupBy"
      heading={t("workspace.shelves.alluvialStages")}
      columnLabel={t("workspace.shelves.column")}
      placeholder={t("workspace.shelves.selectColumn")}
      // Alluvial needs >= 2 stages for any flow to render; the trash
      // icon disappears at the floor so the user can't remove their way
      // below the minimum.
      minSeries={2}
    />
  );
}

function AlluvialValueShelf({ form, columns }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const valueColumns = useMemo(() => filterColumnsForRole(columns, "alluvial", "value"), [columns]);
  return (
    <SingleColumnShelf
      form={form}
      columns={valueColumns}
      role="value"
      heading={t("workspace.shelves.alluvialValue")}
      columnLabel={t("workspace.shelves.column")}
      placeholder={t("workspace.shelves.selectColumn")}
    />
  );
}

export const alluvialDataShelves: ShelfDef[] = [
  {
    key: "stages",
    labelKey: "workspace.shelves.alluvialStages",
    icon: Layers,
    Component: AlluvialStagesShelf,
    summary: (form, t) => {
      const sources = form.getValues("dataConfig.dataSources");
      const stages = dataSourcesByRole(sources, "groupBy").filter(
        (entry) => entry.source.columnName && entry.source.columnName.length > 0,
      );
      if (stages.length === 0) return undefined;
      if (stages.length === 1) return stages[0]?.source.columnName;
      return t("workspace.shelves.stagesCount", { count: stages.length });
    },
  },
  {
    key: "value",
    labelKey: "workspace.shelves.alluvialValue",
    icon: Sigma,
    Component: AlluvialValueShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "value")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
];
