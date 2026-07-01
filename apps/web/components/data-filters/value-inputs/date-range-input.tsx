"use client";

import { Calendar as CalendarIcon } from "lucide-react";
import { useMemo, useState } from "react";

import type { ExperimentDataFilterValue } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Calendar } from "@repo/ui/components/calendar";
import { Input } from "@repo/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { Separator } from "@repo/ui/components/separator";
import { cn } from "@repo/ui/lib/utils";

import { applyTimeOfDay, formatHm, formatYmdHm, parseIsoDate } from "../../../util/date";
import type { DateRangePresetDef, DateRangePresetId } from "./date-range-presets";
import { DATE_RANGE_PRESETS, computeDateRangePreset } from "./date-range-presets";

const DAY_END_TIME = "23:59";
const DAY_START_TIME = "00:00";
const EMPTY_BOUND_LABEL = "…";

interface DateRangeInputProps {
  value: ExperimentDataFilterValue;
  onChange: (value: ExperimentDataFilterValue) => void;
}

interface ParsedRange {
  start: Date | undefined;
  end: Date | undefined;
}

export function DateRangeInput({ value, onChange }: DateRangeInputProps) {
  const { t } = useTranslation("common");
  const { start, end } = parseRange(value);
  const [open, setOpen] = useState(false);

  const startTime = start ? formatHm(start) : DAY_START_TIME;
  const endTime = end ? formatHm(end) : DAY_END_TIME;
  const isUnset = !start && !end;

  const emitBounds = (nextStart: Date | undefined, nextEnd: Date | undefined) => {
    const hasNoBounds = !nextStart && !nextEnd;
    if (hasNoBounds) {
      onChange([]);
      return;
    }
    onChange([nextStart ? nextStart.toISOString() : "", nextEnd ? nextEnd.toISOString() : ""]);
  };

  const handleRangeSelect = (range: { from?: Date; to?: Date } | undefined) => {
    const isClearedSelection = !range?.from && !range?.to;
    if (isClearedSelection) {
      emitBounds(undefined, undefined);
      return;
    }
    const nextStart = range.from ? applyTimeOfDay(range.from, startTime) : undefined;
    const nextEnd = range.to ? applyTimeOfDay(range.to, endTime) : undefined;
    emitBounds(nextStart, nextEnd);
  };

  const handleStartTime = (raw: string) => {
    if (!start) {
      return;
    }
    emitBounds(applyTimeOfDay(start, raw), end);
  };

  const handleEndTime = (raw: string) => {
    if (!end) {
      return;
    }
    emitBounds(start, applyTimeOfDay(end, raw));
  };

  const applyPreset = (id: DateRangePresetId) => {
    const [s, e] = computeDateRangePreset(id);
    emitBounds(s, e);
    setOpen(false);
  };

  const triggerLabel = useMemo(() => {
    if (isUnset) {
      return t("dataFilters.pickRange");
    }
    const startLabel = start ? formatYmdHm(start) : EMPTY_BOUND_LABEL;
    const endLabel = end ? formatYmdHm(end) : EMPTY_BOUND_LABEL;
    return `${startLabel} → ${endLabel}`;
  }, [start, end, isUnset, t]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("h-9 w-full justify-start font-normal", isUnset && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{triggerLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          <div className="flex w-[140px] flex-col gap-0.5 border-r p-2">
            {DATE_RANGE_PRESETS.map((preset) => (
              <PresetButton key={preset.id} preset={preset} onSelect={applyPreset} />
            ))}
          </div>
          <div>
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={{ from: start, to: end }}
              onSelect={handleRangeSelect}
              defaultMonth={start ?? new Date()}
            />
            <Separator />
            <div className="flex items-center gap-2 p-3">
              <span className="text-muted-foreground text-xs">{t("dataFilters.rangeFrom")}</span>
              <Input
                type="time"
                className="h-8 w-[100px]"
                value={startTime}
                onChange={(e) => handleStartTime(e.target.value)}
                disabled={!start}
              />
              <span className="text-muted-foreground text-xs">{t("dataFilters.rangeTo")}</span>
              <Input
                type="time"
                className="h-8 w-[100px]"
                value={endTime}
                onChange={(e) => handleEndTime(e.target.value)}
                disabled={!end}
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PresetButton({
  preset,
  onSelect,
}: {
  preset: DateRangePresetDef;
  onSelect: (id: DateRangePresetId) => void;
}) {
  const { t } = useTranslation("common");
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 justify-start px-2 text-xs font-normal"
      onClick={() => onSelect(preset.id)}
    >
      {t(preset.labelKey)}
    </Button>
  );
}

function parseRange(value: ExperimentDataFilterValue): ParsedRange {
  if (!Array.isArray(value)) {
    return { start: undefined, end: undefined };
  }
  return { start: parseIsoDate(value[0]), end: parseIsoDate(value[1]) };
}
