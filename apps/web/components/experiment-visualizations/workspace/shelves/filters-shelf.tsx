"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";

import type {
  ExperimentDataColumn,
  ExperimentDataFilter,
} from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import { cn } from "@repo/ui/lib/utils";

import { FilterChipList } from "../../../data-filters/chips/filter-chip-list";
import type { ChartFormValues } from "../../charts/chart-config";

interface FiltersShelfProps {
  form: UseFormReturn<ChartFormValues>;
  columns: ExperimentDataColumn[];
  experimentId: string;
  tableName: string;
  /** Render inline with no Collapsible chrome (for popover-hosted shelves). */
  flat?: boolean;
}

export function FiltersShelf({
  form,
  columns,
  experimentId,
  tableName,
  flat = false,
}: FiltersShelfProps) {
  const { t } = useTranslation("experimentVisualizations");

  const { fields } = useFieldArray({
    control: form.control,
    name: "dataConfig.filters",
  });

  const [open, setOpen] = useState(false);

  const filters = (form.watch("dataConfig.filters") ?? []) as ExperimentDataFilter[];

  const list = (
    <FilterChipList
      value={filters}
      onChange={(next) =>
        form.setValue("dataConfig.filters", next.length > 0 ? next : undefined, {
          shouldDirty: true,
        })
      }
      columns={columns}
      experimentId={experimentId}
      tableName={tableName}
    />
  );

  if (flat) {
    return <div className="space-y-3">{list}</div>;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section className="space-y-3">
        <CollapsibleTrigger className="flex w-full items-center gap-2 text-left">
          <h3 className="text-sm font-semibold">{t("workspace.shelves.filters")}</h3>
          {fields.length > 0 && (
            <span className="text-muted-foreground text-xs">({fields.length})</span>
          )}
          <ChevronDown
            className={cn(
              "text-muted-foreground ml-auto h-4 w-4 transition-transform",
              open && "rotate-180",
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>{list}</CollapsibleContent>
      </section>
    </Collapsible>
  );
}
