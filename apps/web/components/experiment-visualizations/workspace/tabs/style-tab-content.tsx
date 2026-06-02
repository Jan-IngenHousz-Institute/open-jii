"use client";

import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import type { ChartFormValues } from "../../charts/chart-config";
import { getChartTypeDef } from "../../charts/chart-registry";

export interface StyleTabContentProps {
  form: UseFormReturn<ChartFormValues>;
  columns: DataColumn[];
}

export function StyleTabContent({ form, columns }: StyleTabContentProps) {
  const chartType = useWatch({ control: form.control, name: "chartType" });
  const def = getChartTypeDef(chartType);
  return <def.StylePanel form={form} columns={columns} />;
}
