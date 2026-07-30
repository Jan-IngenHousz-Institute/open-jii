"use client";

import { CalendarIcon, Info } from "lucide-react";
import { useId, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { ExperimentVisibility } from "@repo/api/domains/experiment/experiment.schema";
import { zExperimentVisibility } from "@repo/api/domains/experiment/experiment.schema";
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
import { Label } from "@repo/ui/components/label";
import { Popover, PopoverTrigger, PopoverContent } from "@repo/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";

import { isoToLocalCalendarDate, embargoUntilHelperString } from "../new-experiment/embargo-utils";

interface EmbargoFormValues {
  embargoUntil?: string;
}

interface ExperimentVisibilityFormProps {
  form: UseFormReturn<EmbargoFormValues>;
  /** Visibility as it stands; the select reflects it rather than owning it. */
  currentVisibility: ExperimentVisibility;
  isArchived: boolean;
  onVisibilityChange: (newVisibility: ExperimentVisibility) => void;
  onEmbargoDateSelect: (date?: Date) => Promise<void>;
}

/**
 * Visibility and embargo for an experiment.
 *
 * The visibility select is a plain controlled input, not a form field: nothing
 * here is submitted. Picking a value hands it straight to the card, which
 * confirms the change and writes it through the dedicated publish route — so the
 * select goes on showing the persisted visibility until that write lands. Once
 * public it is disabled, which is how the interface carries the one-way rule the
 * backend enforces.
 *
 * The embargo date schedules the automatic private→public transition, so it is
 * only meaningful — and only rendered — while the experiment is still private.
 */
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
  // The label points at the select trigger, which is a button and so labelable.
  const visibilityFieldId = useId();

  const isPublic = currentVisibility === "public";

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
        <div className="space-y-2">
          <Label htmlFor={visibilityFieldId}>{t("experimentSettings.visibility")}</Label>
          <Select
            value={currentVisibility}
            onValueChange={(value) => onVisibilityChange(value as ExperimentVisibility)}
            disabled={isArchived || isPublic}
          >
            <SelectTrigger id={visibilityFieldId}>
              <SelectValue placeholder={t("experimentSettings.visibilityPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {Object.values(zExperimentVisibility.enum).map((value) => (
                <SelectItem key={value} value={value}>
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isPublic && (
            // Same copy the macro/protocol/workbook control shows, from the same
            // key: the published state means the same thing on all four types, so
            // it is worded once rather than per type.
            <div className="bg-surface-light text-muted-foreground flex items-center gap-2 rounded-md p-2 text-xs">
              <Info className="text-primary h-4 w-4 shrink-0" />
              <div className="leading-tight">{t("resourceVisibility.publishedDescription")}</div>
            </div>
          )}
        </div>

        {!isPublic && (
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
                      <Info className="text-primary h-4 w-4 shrink-0" />
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
