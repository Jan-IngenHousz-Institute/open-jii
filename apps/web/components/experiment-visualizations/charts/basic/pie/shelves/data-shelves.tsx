"use client";

import { Sigma, Tag } from "lucide-react";
import { useMemo } from "react";

import { filterColumnsForRole } from "@repo/api/domains/experiment/visualizations/experiment-visualization-contracts";

import { firstDataSourceByRole } from "../../../data/data-sources";
import type { ChartPanelProps, ShelfDef } from "../../../types";
import { PieLabelsShelf } from "./labels-shelf";
import { PieValuesShelf } from "./values-shelf";

function PieLabelsShelfWrapper({ form, columns }: ChartPanelProps) {
  const labelColumns = useMemo(() => filterColumnsForRole(columns, "pie", "labels"), [columns]);
  return <PieLabelsShelf form={form} columns={labelColumns} />;
}

function PieValuesShelfWrapper({ form, columns }: ChartPanelProps) {
  const valueColumns = useMemo(() => filterColumnsForRole(columns, "pie", "values"), [columns]);
  return <PieValuesShelf form={form} columns={valueColumns} />;
}

export const pieDataShelves: ShelfDef[] = [
  {
    key: "labels",
    labelKey: "workspace.shelves.labels",
    icon: Tag,
    Component: PieLabelsShelfWrapper,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "labels")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
  {
    key: "values",
    labelKey: "workspace.shelves.values",
    icon: Sigma,
    Component: PieValuesShelfWrapper,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "values")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
];
