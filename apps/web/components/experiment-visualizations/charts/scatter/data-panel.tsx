"use client";

import { Separator } from "@repo/ui/components/separator";

import { ColorDimensionShelf } from "../../workspace/shelves/color-dimension-shelf";
import { XAxisShelf } from "../../workspace/shelves/x-axis-shelf";
import { YAxisShelf } from "../../workspace/shelves/y-axis-shelf";
import type { ChartPanelProps } from "../types";

export function ScatterDataPanel({ form, columns }: ChartPanelProps) {
  return (
    <div className="space-y-6">
      <XAxisShelf form={form} columns={columns} />
      <Separator />
      <YAxisShelf form={form} columns={columns} />
      <Separator />
      <ColorDimensionShelf form={form} columns={columns} />
    </div>
  );
}
