"use client";

import { useFormContext } from "react-hook-form";

import type { LayoutSheetApplication } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import { Label } from "@repo/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/radio-group";
import { Textarea } from "@repo/ui/components/textarea";

import { PlacementDatePicker } from "../experiment-settings/devices/placement-date-picker";

export interface AttributeChangeLabels {
  planned: string;
  plannedHelp: string;
  correction: string;
  correctionHelp: string;
}

interface AttributeChangeFieldsProps {
  labels: AttributeChangeLabels;
}

/**
 * Asks whether a new value is planned from a date or corrects a mistake, with the date or the
 * reason that goes with it. Reads the kind, date and reason fields of the surrounding form.
 */
export function AttributeChangeFields({ labels }: AttributeChangeFieldsProps) {
  const { t } = useTranslation("experiments");
  const { control, watch } = useFormContext<LayoutSheetApplication>();
  const isPlanned = watch("kind") === "planned";

  return (
    <div className="space-y-3" data-attribute-change>
      <FormField
        control={control}
        name="kind"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <RadioGroup value={field.value} onValueChange={field.onChange} className="gap-2">
                <div className="flex items-start gap-2">
                  <RadioGroupItem
                    value="planned"
                    id="attribute-change-planned"
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="attribute-change-planned"
                    className="flex-col items-start gap-0.5"
                  >
                    <span>{labels.planned}</span>
                    <span className="text-muted-foreground text-xs font-normal">
                      {labels.plannedHelp}
                    </span>
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem
                    value="correction"
                    id="attribute-change-correction"
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="attribute-change-correction"
                    className="flex-col items-start gap-0.5"
                  >
                    <span>{labels.correction}</span>
                    <span className="text-muted-foreground text-xs font-normal">
                      {labels.correctionHelp}
                    </span>
                  </Label>
                </div>
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {isPlanned ? (
        <FormField
          control={control}
          name="appliesFrom"
          render={({ field }) => (
            <FormItem className="pl-6">
              <FormLabel>{t("layout.change.appliesFrom")}</FormLabel>
              <FormControl>
                <PlacementDatePicker value={field.value ?? ""} onChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
      ) : (
        <FormField
          control={control}
          name="reason"
          render={({ field }) => (
            <FormItem className="pl-6">
              <FormLabel>{t("layout.change.reason")}</FormLabel>
              <FormControl>
                <Textarea
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  rows={2}
                  placeholder={t("layout.change.reasonPlaceholder")}
                />
              </FormControl>
              <FormDescription>{t("layout.change.reasonHelp")}</FormDescription>
            </FormItem>
          )}
        />
      )}
    </div>
  );
}
