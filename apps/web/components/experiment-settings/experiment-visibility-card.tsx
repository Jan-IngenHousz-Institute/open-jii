"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { zExperimentVisibility, visibilitySchema } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
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
import { toast } from "@repo/ui/hooks";
import { cn } from "@repo/ui/lib/utils";

import { useExperimentUpdate } from "../../hooks/experiment/useExperimentUpdate/useExperimentUpdate";
import {
  isoToLocalCalendarDate,
  localCalendarDateToIsoEndOfDay,
  embargoUntilHelperString,
} from "../new-experiment/embargo-utils";

interface ExperimentVisibilityCardProps {
  experimentId: string;
  initialVisibility: "private" | "public";
  embargoUntil: string;
}

export function ExperimentVisibilityCard({
  experimentId,
  initialVisibility,
  embargoUntil,
}: ExperimentVisibilityCardProps) {
  const { mutateAsync: updateExperiment, isPending: isUpdating } = useExperimentUpdate();
  const { t } = useTranslation();
  const [currentVisibility, setCurrentVisibility] = useState<"private" | "public">(
    initialVisibility,
  );

  interface VisibilityFormValues {
    visibility?: "private" | "public";
    embargoUntil?: string;
  }

  const form = useForm<VisibilityFormValues>({
    resolver: zodResolver(visibilitySchema),
    defaultValues: {
      visibility: initialVisibility,
      embargoUntil,
    },
  });

  // Watch visibility to conditionally display the embargo field
  const visibility = form.watch("visibility");

  async function onSubmit(data: VisibilityFormValues) {
    if (data.visibility === undefined) return;

    const updateData = {
      visibility: data.visibility,
      ...(data.visibility === "private" && {
        embargoUntil: data.embargoUntil,
      }),
    };

    await updateExperiment({
      params: { id: experimentId },
      body: updateData,
    });
    toast({ description: t("experiments.experimentUpdated") });
    // If visibility was changed to public, update local state so UI disables private
    if (data.visibility === "public") {
      setCurrentVisibility("public");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("experimentSettings.visibility")}</CardTitle>
        <CardDescription>{t("experimentSettings.generalDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="visibility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("experimentSettings.visibility")}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={currentVisibility === "public"}
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
                    <div className="text-muted-foreground pt-1 text-xs">
                      {t("experimentSettings.visibilityCannotBeChanged")}
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
                    : t("experimentSettings.pickADate");

                  return (
                    <FormItem className="space-y-3">
                      <FormLabel>{t("experimentSettings.embargoUntil")}</FormLabel>
                      <FormControl>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "justify-start text-left font-normal",
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

            <div className="flex justify-end">
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? t("experimentSettings.saving") : t("experimentSettings.save")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
