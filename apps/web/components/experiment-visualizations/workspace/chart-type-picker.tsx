"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { ChartFamily, ChartType } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { cn } from "@repo/ui/lib/utils";

import { getChartTypeDef, listChartTypesByFamily } from "../charts/registry";

const FAMILY_ORDER: ChartFamily[] = ["basic", "statistical", "scientific", "3d"];

interface ChartTypePickerProps {
  value: ChartType;
  onChange: (type: ChartType) => void;
}

export function ChartTypePicker({ value, onChange }: ChartTypePickerProps) {
  const { t } = useTranslation("experimentVisualizations");
  const [open, setOpen] = useState(false);

  const grouped = listChartTypesByFamily();
  const current = getChartTypeDef(value);
  const TriggerIcon = current?.icon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2"
          aria-label={t("workspace.charts.pickerLabel")}
        >
          {TriggerIcon ? (
            <TriggerIcon className="size-4" />
          ) : null}
          <span className="text-sm font-medium">
            {current ? t(current.labelKey) : value}
          </span>
          <ChevronDown className="text-muted-foreground size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[440px] p-0" align="start" sideOffset={8}>
        <ScrollArea className="max-h-[420px]">
          <div className="space-y-5 p-4">
            {FAMILY_ORDER.map((family) => {
              const types = grouped[family];
              if (types.length === 0) return null;
              return (
                <div key={family} className="space-y-2">
                  <h4 className="text-muted-foreground text-[11px] font-medium uppercase tracking-[0.08em]">
                    {t(`workspace.families.${family}`)}
                  </h4>
                  <div className="grid grid-cols-4 gap-1.5">
                    {types.map((def) => {
                      const TileIcon = def.icon;
                      const isActive = def.type === value;
                      return (
                        <button
                          key={def.type}
                          type="button"
                          onClick={() => {
                            onChange(def.type);
                            setOpen(false);
                          }}
                          className={cn(
                            "flex flex-col items-center gap-1.5 rounded-md border p-3 text-xs transition-colors",
                            isActive
                              ? "border-primary bg-primary/5 text-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground border-transparent",
                          )}
                          aria-pressed={isActive}
                        >
                          <TileIcon className="size-5" />
                          <span className="text-center leading-tight">{t(def.labelKey)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
