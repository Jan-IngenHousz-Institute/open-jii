"use client";

import { CalendarIcon, Info } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { ExperimentVisibility } from "@repo/api";
import { zExperimentVisibility } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Calendar,
} from "@repo/ui/components";
import { cn } from "@repo/ui/lib/utils";

import { isoToLocalCalendarDate, embargoUntilHelperString } from "../new-experiment/embargo-utils";

interface VisibilityFormValues {
  visibility?: ExperimentVisibility;
  embargoUntil?: string;
}

interface ExperimentVisibilityFormProps {
  form: UseFormReturn<VisibilityFormValues>;
  currentVisibility: ExperimentVisibility;
  isArchived: boolean;
  onVisibilityChange: (newVisibility: ExperimentVisibility) => void;
  onEmbargoDateSelect: (date?: Date) => Promise<void>;
}

export function ExperimentVisibilityForm({
  form,
  currentVisibility,
  isArchived,
  onVisibilityChange,
  onEmbargoDateSelect,
}: ExperimentVisibilityFormProps) {
  const { t } = useTranslation();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [isSavingEmbargo, setIsSavingEmbargo] = useState(false);

  const visibility = form.watch("visibility");

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
          control={form.control}
          name="visibility"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("experimentSettings.visibility")}</FormLabel>
              <Select
                onValueChange={onVisibilityChange}
                defaultValue={field.value}
                value={field.value}
                disabled={isArchived || currentVisibility === "public"}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("experimentSettings.visibilityPlaceholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.values(zExperimentVisibility.enum).map((value) => (
                    <SelectItem key={value} value={value}>
                      {value.charAt(0).toUpperCase() + value.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {visibility === "public" && (
                <div className="bg-surface-light text-muted-foreground flex items-center gap-2 rounded-md p-2 text-xs">
                  <Info className="text-primary h-4 w-4" />
                  <div className="leading-tight">
                    {t("experimentSettings.visibilityCannotBeChanged")}
                  </div>
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {visibility === "private" && (
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
                            "w-full justify-between font-normal",
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
                    <div className="bg-surface-light text-muted-foreground flex items-center gap-2 rounded-md p-2 text-xs">
                      <Info className="text-primary h-4 w-4" />
                      <div className="leading-tight">{helperText}</div>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        )}
      </div>
    </Form>
  );
}
