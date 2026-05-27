"use client";

import type { UseFormReturn } from "react-hook-form";

import { useTranslation } from "@repo/i18n";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import { FormSlider } from "@repo/ui/components/form-slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import type { ChartFormValues } from "../../charts/chart-config";
import { CollapsibleStyleSection } from "./shared/collapsible-style-section";

interface MarkerStyleSectionProps {
  form: UseFormReturn<ChartFormValues>;
  titleKey?: string;
  defaultTitle?: string;
  flat?: boolean;
}

/**
 * Reusable marker-style controls: size + symbol. `marker.opacity` is
 * not here; it's exposed via each chart's primary section.
 */
export function MarkerStyleSection({
  form,
  titleKey = "workspace.style.markerOptions",
  defaultTitle,
  flat = false,
}: MarkerStyleSectionProps) {
  const { t } = useTranslation("experimentVisualizations");

  return (
    <CollapsibleStyleSection title={t(titleKey, defaultTitle ?? "Markers")} flat={flat}>
      <FormField
        control={form.control}
        name="config.marker.size"
        render={({ field }) => (
          <FormSlider
            label={t("workspace.style.markerSize")}
            // Plotly types marker.size as `number | number[]` for per-point
            // sizing; the slider only edits the scalar form. Fall back when
            // an array (e.g. bubble's per-point sizes) is present.
            value={typeof field.value === "number" ? field.value : undefined}
            fallback={6}
            min={1}
            max={20}
            step={1}
            onCommit={field.onChange}
            formatBadge={(v) => `${v}px`}
          />
        )}
      />

      <FormField
        control={form.control}
        name="config.marker.symbol"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">
              {t("workspace.style.markerShape")}
            </FormLabel>
            <Select value={String(field.value ?? "circle")} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="circle">{t("workspace.markerSymbols.circle")}</SelectItem>
                <SelectItem value="square">{t("workspace.markerSymbols.square")}</SelectItem>
                <SelectItem value="diamond">{t("workspace.markerSymbols.diamond")}</SelectItem>
                <SelectItem value="triangle-up">
                  {t("workspace.markerSymbols.triangleUp")}
                </SelectItem>
                <SelectItem value="triangle-down">
                  {t("workspace.markerSymbols.triangleDown")}
                </SelectItem>
                <SelectItem value="star">{t("workspace.markerSymbols.star")}</SelectItem>
                <SelectItem value="hexagon">{t("workspace.markerSymbols.hexagon")}</SelectItem>
                <SelectItem value="cross">{t("workspace.markerSymbols.cross")}</SelectItem>
                <SelectItem value="x">{t("workspace.markerSymbols.x")}</SelectItem>
                <SelectItem value="asterisk">{t("workspace.markerSymbols.asterisk")}</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </CollapsibleStyleSection>
  );
}
