"use client";

import type { UseFormReturn } from "react-hook-form";
import { ColumnName } from "~/components/experiment-data/column-name";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import type { ChartFormValues } from "../../charts/chart-config";

const NO_COLUMN = "__none__";

interface WindowColumnSelectProps {
  form: UseFormReturn<ChartFormValues>;
  name: `dataConfig.dataSources.${number}.${"partitionColumn" | "orderColumn"}`;
  label: string;
  emptyLabel: string;
  columns: ExperimentDataColumn[];
  onChange: () => void;
}

export function WindowColumnSelect({
  form,
  name,
  label,
  emptyLabel,
  columns,
  onChange,
}: WindowColumnSelectProps) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-medium">{label}</FormLabel>
          <Select
            value={field.value === "" ? NO_COLUMN : (field.value ?? NO_COLUMN)}
            onValueChange={(value) => {
              field.onChange(value === NO_COLUMN ? "" : value);
              onChange();
            }}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value={NO_COLUMN}>{emptyLabel}</SelectItem>
              {columns.map((column) => (
                <SelectItem key={column.name} value={column.name}>
                  <ColumnName column={column} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
