"use client";

import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { ExperimentDataColumn, ExperimentRole } from "@repo/api/domains/experiment/experiment.schema";
import { Badge } from "@repo/ui/components/badge";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import type { ChartFormValues } from "../../charts/chart-config";
import { firstDataSourceByRole } from "../../charts/data/data-sources";

interface SingleColumnShelfProps {
  form: UseFormReturn<ChartFormValues>;
  columns: ExperimentDataColumn[];
  role: ExperimentRole;
  heading: string;
  columnLabel: string;
  placeholder: string;
}

/** Generic single-column picker for non-axis roles (size, labels, values). */
export function SingleColumnShelf({
  form,
  columns,
  role,
  heading,
  columnLabel,
  placeholder,
}: SingleColumnShelfProps) {
  const sources = useWatch({ control: form.control, name: "dataConfig.dataSources" });
  const indexed = firstDataSourceByRole(sources, role);
  const sourceIndex = indexed?.index ?? 0;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{heading}</h3>

      <FormField
        control={form.control}
        name={`dataConfig.dataSources.${sourceIndex}.columnName` as const}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">{columnLabel}</FormLabel>
            <Select
              value={field.value}
              onValueChange={(value) => {
                const tableName = form.getValues("dataConfig.tableName");
                form.setValue(`dataConfig.dataSources.${sourceIndex}.tableName`, tableName);
                field.onChange(value);
              }}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder={placeholder} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {columns.map((column) => (
                  <SelectItem key={column.name} value={column.name}>
                    <div className="flex items-center gap-2">
                      <span>{column.name}</span>
                      <Badge
                        variant="outline"
                        className="text-muted-foreground h-4 px-1.5 py-0 font-mono text-[10px] font-normal leading-none"
                      >
                        {column.type_name}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </section>
  );
}
