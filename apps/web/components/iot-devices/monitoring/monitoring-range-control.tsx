"use client";

import { format } from "date-fns";
import { CalendarIcon, RefreshCw } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Calendar } from "@repo/ui/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { Separator } from "@repo/ui/components/separator";
import { cn } from "@repo/ui/lib/utils";

import type { MonitoringPresetId, MonitoringRange } from "./monitoring-range";
import {
  MONITORING_PRESETS,
  rangeFromCalendarSelection,
  resolveMonitoringPreset,
} from "./monitoring-range";

interface MonitoringRangeControlProps {
  range: MonitoringRange;
  activePreset: MonitoringPresetId | null;
  onRangeChange: (range: MonitoringRange, preset: MonitoringPresetId | null) => void;
  /** A refresh is in flight; the whole dashboard keeps its previous data. */
  isUpdating: boolean;
}

/**
 * The dashboard's single time control: quick presets for the common windows
 * and an absolute picker for anything else. Every panel reads this one range,
 * so the time axes stay aligned and comparable.
 */
export function MonitoringRangeControl({
  range,
  activePreset,
  onRangeChange,
  isUpdating,
}: MonitoringRangeControlProps) {
  const { t } = useTranslation("iot");
  const [open, setOpen] = useState(false);

  const handlePreset = (preset: MonitoringPresetId) => {
    onRangeChange(resolveMonitoringPreset(preset), preset);
  };

  const handleCalendarSelect = (selected: { from?: Date; to?: Date } | undefined) => {
    const range = rangeFromCalendarSelection(selected);
    if (range === null) {
      return;
    }

    onRangeChange(range, null);
    setOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isUpdating && (
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <RefreshCw className="h-3 w-3 animate-spin" />
          {t("iot.devices.monitoring.updating")}
        </span>
      )}

      <div className="bg-muted flex items-center rounded-md p-0.5">
        {MONITORING_PRESETS.map((preset) => (
          <Button
            key={preset}
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={activePreset === preset}
            className={cn(
              "h-7 px-2.5 text-xs font-normal",
              activePreset === preset && "bg-background shadow-sm",
            )}
            onClick={() => {
              handlePreset(preset);
            }}
          >
            {t(`iot.devices.monitoring.range.${preset}`)}
          </Button>
        ))}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("h-8 gap-2 font-normal", activePreset === null && "border-primary")}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            <span className="tabular-nums">
              {format(new Date(range.from), "MMM d, HH:mm")} –{" "}
              {format(new Date(range.to), "MMM d, HH:mm")}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            numberOfMonths={2}
            defaultMonth={new Date(range.from)}
            selected={{ from: new Date(range.from), to: new Date(range.to) }}
            onSelect={handleCalendarSelect}
          />
          <Separator />
          <p className="text-muted-foreground p-3 text-xs">
            {t("iot.devices.monitoring.rangeLimit", { days: 31 })}
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
