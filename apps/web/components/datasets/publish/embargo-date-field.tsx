"use client";

import {
  isoToLocalCalendarDate,
  localCalendarDateToIsoEndOfDay,
} from "@/components/new-experiment/embargo-utils";
import { CalendarIcon } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Calendar } from "@repo/ui/components/calendar";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { cn } from "@repo/ui/lib/utils";

import type { PublishDatasetForm } from "./dataset-publish-schema";

/** The release date, stored at the end of the picked day as the experiment's embargo is. */
export function EmbargoDateField({ form }: { form: UseFormReturn<PublishDatasetForm> }) {
  const { t } = useTranslation("datasets");

  return (
    <FormField
      name="embargoUntil"
      control={form.control}
      render={({ field }) => {
        const selectedDate = isoToLocalCalendarDate(field.value);
        const setDate = (next?: Date) => field.onChange(localCalendarDateToIsoEndOfDay(next));
        const buttonLabel = selectedDate
          ? selectedDate.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : t("access.pickDate");

        return (
          <FormItem className="mt-3 pl-7">
            <FormLabel>{t("access.date")}</FormLabel>
            <FormControl>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-64 justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 size-4" />
                    {buttonLabel}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={selectedDate} onSelect={setDate} initialFocus />
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
