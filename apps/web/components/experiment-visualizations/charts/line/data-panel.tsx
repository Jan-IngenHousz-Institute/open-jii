"use client";

import { useMemo } from "react";

import { filterColumnsForRole } from "@repo/api/utils/visualization-contracts";
import { Separator } from "@repo/ui/components/separator";

import { XAxisShelf } from "../../workspace/shelves/x-axis-shelf";
import { YAxisShelf } from "../../workspace/shelves/y-axis-shelf";
import type { ChartPanelProps } from "../types";

export function LineDataPanel({ form, columns }: ChartPanelProps) {
  const xColumns = useMemo(() => filterColumnsForRole(columns, "line", "x"), [columns]);
  const yColumns = useMemo(() => filterColumnsForRole(columns, "line", "y"), [columns]);

  return (
    <div className="space-y-6">
      <XAxisShelf form={form} columns={xColumns} />
      <Separator />
      <YAxisShelf form={form} columns={yColumns} />
    </div>
  );
}
