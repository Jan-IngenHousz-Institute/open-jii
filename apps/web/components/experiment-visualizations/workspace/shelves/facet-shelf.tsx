"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { useTranslation } from "@repo/i18n";
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

interface FacetShelfProps {
  form: UseFormReturn<ChartFormValues>;
  columns: ExperimentDataColumn[];
  /** Render inline with no Collapsible chrome (for popover-hosted shelves). */
  flat?: boolean;
}

export function FacetShelf({ form, columns, flat = false }: FacetShelfProps) {
  const { t } = useTranslation("experimentVisualizations");

  const { append, update, remove } = useDataSourcesFieldArray();

  const sources = useWatch({ control: form.control, name: "dataConfig.dataSources" });
  const facetEntry = firstDataSourceByRole(sources, "facet");
  const facetColumn = facetEntry?.source.columnName ?? "";

  const handleColumnChange = (value: string) => {
    const isPickingColumn = value && value !== "none";
    const tableName = form.getValues("dataConfig.tableName");

    if (isPickingColumn) {
      const next = { ...makeDataSource(tableName, "facet"), columnName: value };
      if (facetEntry) {
        update(facetEntry.index, next);
      } else {
        append(next);
      }
    } else if (facetEntry) {
      remove(facetEntry.index);
    }
  };

  const [open, setOpen] = useState(false);

  const body = (
    <>
      <FormItem>
        <FormLabel className="text-xs font-medium">{t("workspace.shelves.column")}</FormLabel>
        <Select
          value={facetColumn === "" ? "none" : facetColumn}
          onValueChange={handleColumnChange}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("workspace.shelves.selectColumn")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <span className="text-muted-foreground italic">
                {t("workspace.shelves.facetNone")}
              </span>
            </SelectItem>
            {columns.map((column) => (
              <SelectItem key={column.name} value={column.name}>
                {column.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormItem>

      <p className="text-muted-foreground text-xs">{t("workspace.shelves.facetHelp")}</p>
    </>
  );

  if (flat) {
    return <div className="space-y-3">{body}</div>;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section className="space-y-3">
        <CollapsibleTrigger className="flex w-full items-center gap-2 text-left">
          <h3 className="text-sm font-semibold">{t("workspace.shelves.facetDimension")}</h3>
          {facetColumn && <span className="text-muted-foreground text-xs">({facetColumn})</span>}
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
