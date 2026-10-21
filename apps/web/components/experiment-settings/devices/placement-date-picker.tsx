"use client";

import { useLocale } from "@/hooks/useLocale";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import { Calendar } from "@repo/ui/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";

interface PlacementDatePickerProps {
  id?: string;
  /** A calendar date, YYYY-MM-DD. */
  value: string;
  onChange: (value: string) => void;
}

// Calendar dates are read and written in local time, so a date never shifts by a day at midnight UTC.
function toLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toCalendarDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function PlacementDatePicker({ id, value, onChange }: PlacementDatePickerProps) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const selected = toLocalDate(value);

  const label = selected.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const handleSelect = (date: Date | undefined) => {
    if (date !== undefined) {
      onChange(toCalendarDate(date));
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className="w-full justify-between font-normal"
        >
          {label}
          <CalendarIcon className="ml-2 size-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={handleSelect}
        />
      </PopoverContent>
    </Popover>
  );
}
