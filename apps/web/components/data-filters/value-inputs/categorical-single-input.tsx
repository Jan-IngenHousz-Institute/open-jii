"use client";

import { ChevronsUpDown, Loader2 } from "lucide-react";
import { useId, useMemo, useState } from "react";

import type { ExperimentDataColumn, ExperimentDataFilterValue } from "@repo/api/domains/experiment/experiment.schema";
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

import { ContributorIdentity } from "../../contributor/contributor-identity";
import { chipValueForOption, useDistinctOptions } from "../use-distinct-options";
import { CategoricalOption } from "./categorical-option";

export interface CategoricalSingleInputProps {
  column: ExperimentDataColumn;
  experimentId: string;
  tableName: string;
  value: ExperimentDataFilterValue;
  onChange: (value: ExperimentDataFilterValue) => void;
}

export function CategoricalSingleInput({
  column,
  experimentId,
  tableName,
  value,
  onChange,
}: CategoricalSingleInputProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const { values, isLoading, truncated, isContributor, contributorMap } = useDistinctOptions(
    column,
    experimentId,
    tableName,
  );
  const triggerId = useId();

  const display = useMemo(() => {
    if (Array.isArray(value)) return value.join(", ");
    return value === "" ? "" : String(value);
  }, [value]);

  // CONTRIBUTOR persists as id; look up the JSON struct for rendering.
  const contributorJsonForValue =
    isContributor && display && contributorMap ? contributorMap.get(display) : undefined;

  const handleSelect = (raw: string | number) => {
    onChange(chipValueForOption(raw, isContributor));
    setOpen(false);
  };

  const getChipKey = (raw: string | number) => String(chipValueForOption(raw, isContributor));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={triggerId}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-9 w-full justify-between font-normal",
            !display && "text-muted-foreground",
          )}
        >
          {display && isContributor && contributorJsonForValue ? (
            <ContributorIdentity data={contributorJsonForValue} size="compact" />
          ) : (
            <span className="truncate">{display || t("dataFilters.pickValue")}</span>
          )}
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
              {values.map((v) => (
                <CategoricalOption
                  key={getChipKey(v)}
                  optionValue={String(v)}
                  isSelected={display === getChipKey(v)}
                  isContributor={isContributor}
                  onSelect={() => handleSelect(v)}
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
  );
}
