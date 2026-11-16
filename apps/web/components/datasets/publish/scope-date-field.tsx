"use client";

import { useLocale } from "@/hooks/useLocale";
import { CalendarIcon } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import { Button } from "@repo/ui/components/button";
import { Calendar } from "@repo/ui/components/calendar";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";

import type { PublishDatasetForm } from "./dataset-publish-schema";

/** A calendar day as the picker shows it, at local midnight, so it never shifts a day. */
function toLocalDate(day: string): Date {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

function toCalendarDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

interface ScopeDateFieldProps {
  form: UseFormReturn<PublishDatasetForm>;
  name: "scope.from" | "scope.to";
  label: string;
}

/** One end of Scope's date range, kept as a calendar day because readings are counted per UTC day. */
export function ScopeDateField({ form, name, label }: ScopeDateFieldProps) {
  const locale = useLocale();
  const dayFormat = new Intl.DateTimeFormat(locale, { dateStyle: "long" });

  return (
    <FormField
      name={name}
      control={form.control}
      render={({ field }) => {
        const selected = toLocalDate(field.value);
        const handleSelect = (next?: Date) => {
          if (next !== undefined) {
            field.onChange(toCalendarDay(next));
          }
        };

        return (
          <FormItem className="flex-1">
            <FormLabel>{label}</FormLabel>
            <FormControl>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 size-4" />
                    {dayFormat.format(selected)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selected}
                    defaultMonth={selected}
                    onSelect={handleSelect}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
