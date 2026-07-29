"use client";

import { CalendarIcon, Info } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Calendar } from "@repo/ui/components/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import { Popover, PopoverTrigger, PopoverContent } from "@repo/ui/components/popover";
import { cn } from "@repo/ui/lib/utils";

import { isoToLocalCalendarDate, embargoUntilHelperString } from "../new-experiment/embargo-utils";

interface EmbargoFormValues {
  embargoUntil?: string;
}

interface ExperimentVisibilityFormProps {
  form: UseFormReturn<EmbargoFormValues>;
  isArchived: boolean;
  onEmbargoDateSelect: (date?: Date) => Promise<void>;
}

/**
 * Embargo date editor for a still-private experiment. Visibility itself is no
 * longer edited here — publishing is a deliberate one-way action handled by the
 * card's Publish button. The embargo date schedules the automatic
 * private→public transition; it is only meaningful while the experiment is
 * private, so the card renders this form only in that state.
 */
export function ExperimentVisibilityForm({
  form,
  isArchived,
  onEmbargoDateSelect,
}: ExperimentVisibilityFormProps) {
  const { t } = useTranslation();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [isSavingEmbargo, setIsSavingEmbargo] = useState(false);

  const handleEmbargoDateSelect = async (date?: Date) => {
    try {
      setIsSavingEmbargo(true);
      await onEmbargoDateSelect(date);
    } finally {
      setIsSavingEmbargo(false);
      setCalendarOpen(false);
    }
  };

  return (
    <Form {...form}>
      <div className="space-y-4">
        <FormField
          name="embargoUntil"
          control={form.control}
          render={({ field }) => {
            const selectedDate = isoToLocalCalendarDate(field.value);
            const helperText = embargoUntilHelperString(field.value, t);

            const buttonLabel = selectedDate
              ? selectedDate.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : t("experimentSettings.pickADate");

            return (
              <FormItem className="space-y-3">
                <FormLabel>{t("experimentSettings.embargoUntil")}</FormLabel>
                <FormControl className="flex flex-col gap-3 sm:flex-row">
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={isArchived || isSavingEmbargo}
                        className={cn(
                          "hover:bg-surface-light w-full justify-between font-normal disabled:hover:bg-transparent",
                          !selectedDate && "text-muted-foreground",
                        )}
                      >
                        {isSavingEmbargo ? t("experimentSettings.saving") : buttonLabel}
                        <CalendarIcon className="ml-2 h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={handleEmbargoDateSelect}
                        initialFocus
                        disabled={isSavingEmbargo}
                      />
                    </PopoverContent>
                  </Popover>
                </FormControl>
                {helperText && (
                  <div className="bg-surface-light text-muted-foreground flex items-center gap-2 rounded-md p-2 text-sm">
                    <Info className="text-primary h-6 w-6" />
                    <div className="leading-tight">{helperText}</div>
                  </div>
                )}
                <FormMessage />
              </FormItem>
            );
          }}
        />
      </div>
    </Form>
  );
}
