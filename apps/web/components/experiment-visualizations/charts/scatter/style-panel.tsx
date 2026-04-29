"use client";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Separator } from "@repo/ui/components/separator";
import { Slider } from "@repo/ui/components/slider";

import { DisplayOptionsSection } from "../../workspace/style-sections/display-options-section";
import type { ChartPanelProps } from "../types";

export function ScatterStylePanel({ form }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");

  return (
    <div className="space-y-6">
      <DisplayOptionsSection form={form} />
      <Separator />

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">{t("workspace.style.scatterOptions")}</h3>

        <FormField
          control={form.control}
          name="config.mode"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">{t("workspace.style.mode")}</FormLabel>
              <Select value={String(field.value ?? "markers")} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="markers">{t("workspace.modes.markers")}</SelectItem>
                  <SelectItem value="lines+markers">
                    {t("workspace.modes.linesMarkers")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="config.marker.size"
          render={({ field }) => {
            const size = (field.value as number | undefined) ?? 6;
            return (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className="text-xs font-medium">
                    {t("workspace.style.markerSize")}
                  </FormLabel>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {size}px
                  </Badge>
                </div>
                <FormControl>
                  <Slider
                    min={1}
                    max={20}
                    step={1}
                    value={[size]}
                    onValueChange={(values) => field.onChange(values[0])}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
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
                  <SelectItem value="cross">{t("workspace.markerSymbols.cross")}</SelectItem>
                  <SelectItem value="x">{t("workspace.markerSymbols.x")}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </section>
    </div>
  );
}
