"use client";

import { useId } from "react";
import type { UseFormReturn } from "react-hook-form";

import { useTranslation } from "@repo/i18n";
import { Checkbox } from "@repo/ui/components/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";

import type { ChartFormValues } from "../../charts/form-values";

interface DisplayOptionsSectionProps {
  form: UseFormReturn<ChartFormValues>;
}

export function DisplayOptionsSection({ form }: DisplayOptionsSectionProps) {
  const { t } = useTranslation("experimentVisualizations");
  const showLegendId = useId();
  const showGridId = useId();

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{t("workspace.style.display")}</h3>

      <FormField
        control={form.control}
        name="config.title"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">{t("workspace.style.chartTitle")}</FormLabel>
            <FormControl>
              <Input
                placeholder={t("workspace.style.chartTitlePlaceholder")}
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="config.showLegend"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  id={showLegendId}
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor={showLegendId} className="text-xs font-medium">
                {t("workspace.style.showLegend")}
              </FormLabel>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="config.showGrid"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  id={showGridId}
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor={showGridId} className="text-xs font-medium">
                {t("workspace.style.showGrid")}
              </FormLabel>
            </FormItem>
          )}
        />
      </div>
    </section>
  );
}
