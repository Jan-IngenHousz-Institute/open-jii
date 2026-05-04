"use client";

import { useId } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import { useTranslation } from "@repo/i18n";
import { Checkbox } from "@repo/ui/components/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import type { ChartFormValues } from "../../charts/form-values";
import { StyleSubsection } from "./style-subsection";

interface DisplayOptionsSectionProps {
  form: UseFormReturn<ChartFormValues>;
}

export function DisplayOptionsSection({ form }: DisplayOptionsSectionProps) {
  const { t } = useTranslation("experimentVisualizations");
  const showLegendId = useId();
  const showGridId = useId();

  // Hide the legend-position picker when the legend itself is off — it has
  // no effect, and listing a field whose value doesn't matter just adds
  // noise to the panel.
  const showLegend = useWatch({ control: form.control, name: "config.showLegend" }) ?? true;

  return (
    <section className="space-y-5">
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

      <StyleSubsection title={t("workspace.style.legend", "Legend")}>
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

        {showLegend && (
          <FormField
            control={form.control}
            name="config.legendPosition"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium">
                  {t("workspace.style.legendPosition")}
                </FormLabel>
                <Select
                  value={typeof field.value === "string" ? field.value : "right"}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="right">{t("workspace.legendPositions.right")}</SelectItem>
                    <SelectItem value="top">{t("workspace.legendPositions.top")}</SelectItem>
                    <SelectItem value="bottom">{t("workspace.legendPositions.bottom")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </StyleSubsection>

      <StyleSubsection title={t("workspace.style.grid", "Grid")}>
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
      </StyleSubsection>

      <StyleSubsection title={t("workspace.style.interaction", "Interaction")}>
        <FormField
          control={form.control}
          name="config.hoverMode"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">
                {t("workspace.style.hoverMode")}
              </FormLabel>
              <Select
                value={typeof field.value === "string" ? field.value : "closest"}
                onValueChange={field.onChange}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="closest">{t("workspace.hoverModes.closest")}</SelectItem>
                  <SelectItem value="x unified">{t("workspace.hoverModes.xUnified")}</SelectItem>
                  <SelectItem value="y unified">{t("workspace.hoverModes.yUnified")}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </StyleSubsection>
    </section>
  );
}
