"use client";

import { useMemo } from "react";

import { filterColumnsForRole } from "@repo/api/utils/visualization-contracts";
import { Separator } from "@repo/ui/components/separator";

import { ColorDimensionShelf } from "../../workspace/shelves/color-dimension-shelf";
import { XAxisShelf } from "../../workspace/shelves/x-axis-shelf";
import { YAxisShelf } from "../../workspace/shelves/y-axis-shelf";
import type { ChartPanelProps } from "../types";

export function ScatterDataPanel({ form, columns }: ChartPanelProps) {
  const xColumns = useMemo(() => filterColumnsForRole(columns, "scatter", "x"), [columns]);
  const yColumns = useMemo(() => filterColumnsForRole(columns, "scatter", "y"), [columns]);
  const colorColumns = useMemo(() => filterColumnsForRole(columns, "scatter", "color"), [columns]);

  return (
    <div className="space-y-6">
      <XAxisShelf form={form} columns={xColumns} />
      <Separator />
      <YAxisShelf form={form} columns={yColumns} />
      <Separator />
      <ColorDimensionShelf form={form} columns={colorColumns} />
    </div>
  );
}
