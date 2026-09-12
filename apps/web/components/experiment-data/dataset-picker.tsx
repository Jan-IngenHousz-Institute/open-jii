"use client";

import { useLocale } from "@/hooks/useLocale";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

import type { ExperimentTableMetadata } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { useTranslation } from "@repo/i18n/client";
import { Button } from "@repo/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { cn } from "@repo/ui/lib/utils";

type TableType = ExperimentTableMetadata["tableType"];

// Source first, then what was derived from it, then what was brought in.
const GROUP_ORDER: TableType[] = ["static", "macro", "upload"];

const GROUP_LABEL_KEY: Record<TableType, string> = {
  static: "experimentData.datasetGroupStatic",
  macro: "experimentData.datasetGroupMacro",
  upload: "experimentData.datasetGroupUpload",
};

interface DatasetPickerProps {
  tables: ExperimentTableMetadata[];
  value: string;
  onChange: (identifier: string) => void;
}

/**
 * The experiment's datasets are unbounded: two fixed tables plus one per macro
 * that produced output and one per upload. As a tab strip they wrapped to three
 * rows and kept growing, so this is a combobox grouped by where each dataset
 * came from.
 */
export function DatasetPicker({ tables, value, onChange }: DatasetPickerProps) {
  const { t } = useTranslation("experiments");
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  const number = new Intl.NumberFormat(locale);
  const selected = tables.find((table) => table.identifier === value);

  const renderRow = (table: ExperimentTableMetadata) => (
    <CommandItem
      key={table.identifier}
      value={table.displayName}
      onSelect={() => {
        onChange(table.identifier);
        setOpen(false);
      }}
    >
      <Check
        className={cn("h-4 w-4 shrink-0", table.identifier === value ? "opacity-100" : "opacity-0")}
      />
      <span className="min-w-0 flex-1 truncate">{table.displayName}</span>
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {number.format(table.totalRows)}
      </span>
    </CommandItem>
  );

  const renderGroup = (tableType: TableType) => {
    const group = tables.filter((table) => table.tableType === tableType);
    if (group.length === 0) return null;

    return (
      <CommandGroup key={tableType} heading={t(GROUP_LABEL_KEY[tableType])}>
        {group.map(renderRow)}
      </CommandGroup>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={t("experimentData.datasetLabel")}
          className="w-full justify-between font-normal sm:w-96"
        >
          <span className="min-w-0 truncate">{selected?.displayName}</span>
          <span className="flex shrink-0 items-center gap-2">
            {selected !== undefined && (
              <span className="text-muted-foreground text-xs tabular-nums">
                {t("experimentData.datasetRows", {
                  count: selected.totalRows,
                  rows: number.format(selected.totalRows),
                })}
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={t("experimentData.datasetPlaceholder")} />
          <CommandList>
            <CommandEmpty>{t("experimentData.datasetEmpty")}</CommandEmpty>
            {GROUP_ORDER.map(renderGroup)}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
