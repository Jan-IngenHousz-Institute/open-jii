import { CalendarIcon } from "lucide-react";
import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { CreateExperimentBody } from "@repo/api";
import { zExperimentVisibility } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Calendar,
} from "@repo/ui/components";
import { cn } from "@repo/ui/lib/utils";

import {
  isoToLocalCalendarDate,
  localCalendarDateToIsoEndOfDay,
  defaultEmbargoIso90Days,
  embargoUntilHelperString,
} from "./embargo-utils";

interface NewExperimentVisibilityCardProps {
  form: UseFormReturn<CreateExperimentBody>;
}

export function NewExperimentVisibilityCard({ form }: NewExperimentVisibilityCardProps) {
  const { t } = useTranslation();

  const visibility = form.watch("visibility");
  const embargoIso = form.watch("embargoUntil");

  // Always set embargoUntil to 90 days in the future end-of-day if not set
  useEffect(() => {
    if (!embargoIso) {
      form.setValue("embargoUntil", defaultEmbargoIso90Days(), {
        shouldValidate: true,
        shouldDirty: false,
      });
    }
  }, [embargoIso, form]);

  return (
    <Card className="min-w-0 flex-1">
      <CardHeader>
        <CardTitle>{t("newExperiment.visibilityTitle")}</CardTitle>
        <CardDescription>{t("newExperiment.visibilityDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Visibility */}
        <FormField
          control={form.control}
          name="visibility"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("newExperiment.visibility")}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("newExperiment.visibilityPlaceholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(zExperimentVisibility.enum).map(([key]) => (
                    <SelectItem key={key} value={key}>
                      {key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {visibility === zExperimentVisibility.enum.public && (
                <div className="text-muted-foreground pt-1 text-xs">
                  {t("newExperiment.visibilityCannotBeChanged")}
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Embargo date (date-only, store ISO at local end-of-day) */}
        {visibility !== zExperimentVisibility.enum.public && (
          <FormField
            name="embargoUntil"
            control={form.control}
            render={({ field }) => {
              const selectedDate = isoToLocalCalendarDate(field.value);
              const helperText = embargoUntilHelperString(field.value, t);

              const setDate = (next?: Date) => {
                const iso = localCalendarDateToIsoEndOfDay(next);
                field.onChange(iso ?? "");
              };

              const buttonLabel = selectedDate
                ? selectedDate.toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : t("newExperiment.pickADate");

              return (
                <FormItem className="space-y-3">
                  <FormLabel>{t("newExperiment.embargoUntil")}</FormLabel>
                  <FormControl>
                    <div className="flex flex-col gap-3 md:flex-row">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "hover:bg-surface justify-start text-left font-normal",
                              !selectedDate && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {buttonLabel}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={setDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </FormControl>
                  {helperText && (
                    <div className="text-muted-foreground pl-1 pt-1 text-xs">{helperText}</div>
                  )}
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
