"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import { FormItem, FormLabel } from "@repo/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";

import type { ChartFormValues } from "../../charts/chart-config";
import { firstDataSourceByRole, makeDataSource } from "../../charts/data/data-sources";
import { useDataSourcesFieldArray } from "../context/data-sources-field-array-context";

interface GroupByShelfProps {
  form: UseFormReturn<ChartFormValues>;
  columns: DataColumn[];
  /** Render inline with no Collapsible chrome (for popover-hosted shelves). */
  flat?: boolean;
}

const NO_GROUP = "__none__";

// Persists into role: "color" so renderers can use the categorical-split path.
export function GroupByShelf({ form, columns, flat = false }: GroupByShelfProps) {
  const { t } = useTranslation("experimentVisualizations");

  const { append, update, remove } = useDataSourcesFieldArray();
  const sources = useWatch({ control: form.control, name: "dataConfig.dataSources" });
  const entry = firstDataSourceByRole(sources, "color");
  const currentColumn = entry?.source.columnName ?? "";
  const isActive = currentColumn.length > 0;

  const [open, setOpen] = useState(false);

  const handleChange = (value: string) => {
    if (value === NO_GROUP) {
      if (entry) {
        remove(entry.index);
      }
      return;
    }
    const tableName = form.getValues("dataConfig.tableName");
    const next = { ...makeDataSource(tableName, "color"), columnName: value };
    if (entry) {
      update(entry.index, next);
    } else {
      append(next);
    }
    // Force categorical so colorMode-branching renderers take the per-trace path.
    form.setValue("config.colorMode", "categorical", { shouldDirty: true });
  };

  const body = (
    <>
      <FormItem>
        <FormLabel className="text-xs font-medium">{t("workspace.shelves.column")}</FormLabel>
        <Select
          value={currentColumn === "" ? NO_GROUP : currentColumn}
          onValueChange={handleChange}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("workspace.shelves.groupByPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_GROUP}>
              <span className="text-muted-foreground italic">
                {t("workspace.shelves.groupByNone")}
              </span>
            </SelectItem>
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
      </FormItem>

      {currentColumn && (
        <p className="text-muted-foreground text-xs">{t("workspace.shelves.groupByHint")}</p>
      )}
    </>
  );

  if (flat) {
    return <div className="space-y-3">{body}</div>;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section className="space-y-3">
        <CollapsibleTrigger className="flex w-full items-center gap-2 text-left">
          <h3 className="text-sm font-semibold">{t("workspace.shelves.groupBy")}</h3>
          {isActive && <span className="text-muted-foreground text-xs">({currentColumn})</span>}
          <ChevronDown
            className={cn(
              "text-muted-foreground ml-auto h-4 w-4 transition-transform",
              open && "rotate-180",
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-3">{body}</CollapsibleContent>
      </section>
    </Collapsible>
  );
}
