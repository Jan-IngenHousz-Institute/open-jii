"use client";

import { Separator } from "@repo/ui/components/separator";

import type { ChartPanelProps } from "../types";
import { XAxisShelf } from "../../workspace/shelves/x-axis-shelf";
import { YAxisShelf } from "../../workspace/shelves/y-axis-shelf";

export function LineDataPanel({ form, columns }: ChartPanelProps) {
  return (
    <div className="space-y-6">
      <XAxisShelf form={form} columns={columns} />
      <Separator />
      <YAxisShelf form={form} columns={columns} />
    </div>
  );
}
