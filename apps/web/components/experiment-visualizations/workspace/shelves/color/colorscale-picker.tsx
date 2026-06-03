"use client";

import type { FieldPath, UseFormReturn } from "react-hook-form";

import { useTranslation } from "@repo/i18n";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import type { ChartFormValues } from "../../../charts/chart-config";
import { COLORSCALES } from "../../../charts/colors/colorscales";
import { ColorscaleSwatch } from "./colorscale-swatch";

interface ColorscalePickerProps {
  form: UseFormReturn<ChartFormValues>;
  name: FieldPath<ChartFormValues>;
  /** Fallback when the form field holds a non-string value (e.g. fresh form). */
  defaultValue?: string;
  /** Optional label override; defaults to the shared "Color scale" key. */
  labelKey?: string;
}

/** Form-bound Plotly colorscale Select. Renders one item per named scale with a gradient swatch. */
export function ColorscalePicker({
  form,
  name,
  defaultValue = "Viridis",
  labelKey = "workspace.shelves.colorScale",
}: ColorscalePickerProps) {
  const { t } = useTranslation("experimentVisualizations");
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-medium">{t(labelKey)}</FormLabel>
          <Select
            value={typeof field.value === "string" ? field.value : defaultValue}
            onValueChange={field.onChange}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {COLORSCALES.map((cs) => (
                <SelectItem key={cs.value} value={cs.value}>
                  <div className="flex items-center gap-3">
                    <ColorscaleSwatch gradient={cs.gradient} />
                    {t(`workspace.colorscales.${cs.translationKey}`)}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
