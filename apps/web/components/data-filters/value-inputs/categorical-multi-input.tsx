"use client";

import { ChevronsUpDown, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import type { ExperimentDataFilterValue } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
} from "@repo/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { cn } from "@repo/ui/lib/utils";

import { SelectedChip } from "../chips/selected-chip";
import { chipValueForOption, useDistinctOptions } from "../use-distinct-options";
import { CategoricalOption } from "./categorical-option";

export interface CategoricalMultiInputProps {
  column: ExperimentDataColumn;
  experimentId: string;
  tableName: string;
  value: ExperimentDataFilterValue;
  onChange: (value: ExperimentDataFilterValue) => void;
}

export function CategoricalMultiInput({
  column,
  experimentId,
  tableName,
  value,
  onChange,
}: CategoricalMultiInputProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const { values, isLoading, truncated, isContributor, contributorMap } = useDistinctOptions(
    column,
    experimentId,
    tableName,
  );

  const selected = useMemo<string[]>(
    () => (Array.isArray(value) ? value.map((v) => String(v)) : []),
    [value],
  );
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = (raw: string | number) => {
    const chipValue = chipValueForOption(raw, isContributor);
    const key = String(chipValue);

    if (selectedSet.has(key)) {
      onChange(selected.filter((s) => s !== key));
    } else {
      onChange([...selected, chipValue]);
    }
  };

  const remove = (key: string) => {
    onChange(selected.filter((s) => s !== key));
  };

  const triggerLabel =
    selected.length === 0
      ? t("dataFilters.pickValues")
      : t("dataFilters.selectedCount", { count: selected.length });

  const getChipKey = (raw: string | number) => String(chipValueForOption(raw, isContributor));

  // DISTINCT keys on the whole contributor struct, so one person can return
  // several snapshots (name/avatar drift) that all collapse to the same id.
  // Render one option per logical chip key.
  const uniqueValues = useMemo(() => {
    const seen = new Set<string>();
    return values.filter((v) => {
      const key = String(chipValueForOption(v, isContributor));
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [values, isContributor]);

  return (
    <div className="flex flex-col gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "h-9 w-full justify-between font-normal",
              selected.length === 0 && "text-muted-foreground",
            )}
          >
            <span className="truncate">{triggerLabel}</span>
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={t("dataFilters.searchPlaceholder")} />
            <CommandList>
              {isLoading && (
                <div className="text-muted-foreground flex items-center gap-2 p-3 text-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("dataFilters.loading")}
                </div>
              )}
              {!isLoading && <CommandEmpty>{t("dataFilters.noValues")}</CommandEmpty>}
              <CommandGroup>
                {uniqueValues.map((v) => (
                  <CategoricalOption
                    key={getChipKey(v)}
                    optionValue={String(v)}
                    isSelected={selectedSet.has(getChipKey(v))}
                    isContributor={isContributor}
                    onSelect={() => toggle(v)}
                  />
                ))}
              </CommandGroup>
              {truncated && (
                <div className="text-muted-foreground border-t p-2 text-[10px]">
                  {t("dataFilters.truncatedNotice", { count: values.length })}
                </div>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((key) => (
            <SelectedChip
              key={key}
              chipKey={key}
              contributorJson={isContributor ? contributorMap?.get(key) : undefined}
              isContributor={isContributor}
              onRemove={remove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
