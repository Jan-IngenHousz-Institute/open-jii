"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

import type { ExperimentUnit } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
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
import { cn } from "@repo/ui/lib/utils";

interface PlacementPlotSelectProps {
  id?: string;
  units: ExperimentUnit[];
  value: string;
  onChange: (plotId: string) => void;
}

/** Searchable list of the layout's plots, filtered by name in the browser. */
export function PlacementPlotSelect({ id, units, value, onChange }: PlacementPlotSelectProps) {
  const { t } = useTranslation("experiments");
  const [open, setOpen] = useState(false);

  const plots = units.filter((unit) => unit.active);
  const selected = plots.find((plot) => plot.id === value);

  const renderPlot = (plot: ExperimentUnit) => {
    const handleSelect = () => {
      onChange(plot.id);
      setOpen(false);
    };

    return (
      <CommandItem key={plot.id} value={plot.identifier} onSelect={handleSelect}>
        <Check className={cn("size-4", plot.id === value ? "opacity-100" : "opacity-0")} />
        {plot.identifier}
      </CommandItem>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground")}
        >
          <span className="truncate">{selected?.identifier ?? t("layout.placement.plotPlaceholder")}</span>
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder={t("layout.placement.plotSearch")} />
          <CommandList>
            <CommandEmpty>{t("layout.placement.plotEmpty")}</CommandEmpty>
            <CommandGroup>{plots.map(renderPlot)}</CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
