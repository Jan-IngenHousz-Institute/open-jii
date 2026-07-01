"use client";

import { Calendar as CalendarIcon } from "lucide-react";

import type { ExperimentDataFilterValue } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Calendar } from "@repo/ui/components/calendar";
import { Input } from "@repo/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { cn } from "@repo/ui/lib/utils";

import { applyTimeOfDay, formatHm, formatYmd, parseIsoDate } from "../../../util/date";

const DAY_START_TIME = "00:00";

export interface DateTimeInputProps {
  value: ExperimentDataFilterValue;
  onChange: (value: ExperimentDataFilterValue) => void;
}

export function DateTimeInput({ value, onChange }: DateTimeInputProps) {
  const { t } = useTranslation("common");
  const date = parseIsoDate(value);
  const timeValue = date ? formatHm(date) : DAY_START_TIME;

  const handleDateSelect = (selected: Date | undefined) => {
    if (!selected) {
      onChange("");
      return;
    }
    const next = applyTimeOfDay(selected, timeValue);
    onChange(next.toISOString());
  };

  const handleTimeChange = (raw: string) => {
    if (!date) {
      return;
    }

    const next = applyTimeOfDay(date, raw);
    onChange(next.toISOString());
  };

  return (
    <div className="flex gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-9 flex-1 justify-start text-left font-normal",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
            {date ? formatYmd(date) : t("dataFilters.pickDate")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={handleDateSelect} initialFocus />
        </PopoverContent>
      </Popover>
      <Input
        type="time"
        className="h-9 w-[100px]"
        value={timeValue}
        disabled={!date}
        onChange={(e) => handleTimeChange(e.target.value)}
      />
    </div>
  );
}
