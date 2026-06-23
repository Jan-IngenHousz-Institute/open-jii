"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
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

export interface AddColumnPopoverProps {
  remaining: ExperimentDataColumn[];
  onAdd: (name: string) => void;
}

export function AddColumnPopover({ remaining, onAdd }: AddColumnPopoverProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);

  const handleSelect = (name: string) => {
    onAdd(name);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-7 w-full gap-1.5 border-dashed text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("columnPicker.addColumn")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={t("columnPicker.searchPlaceholder")} />
          <CommandList>
            <CommandEmpty>{t("columnPicker.noColumnsLeft")}</CommandEmpty>
            <CommandGroup>
              {remaining.map((col) => (
                <CommandItem
                  key={col.name}
                  value={col.name}
                  onSelect={() => handleSelect(col.name)}
                >
                  <span className="min-w-0 flex-1 truncate">{col.name}</span>
                  <span className="text-muted-foreground/70 ml-2 shrink-0 font-mono text-[10px] uppercase">
                    {col.type_name}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
