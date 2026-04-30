"use client";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Checkbox } from "@repo/ui/components/checkbox";
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

export function LineStylePanel({ form }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");

  return (
    <div className="space-y-6">
      <DisplayOptionsSection form={form} />
      <Separator />

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">{t("workspace.style.lineOptions")}</h3>

        <FormField
          control={form.control}
          name="config.mode"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">{t("workspace.style.mode")}</FormLabel>
              <Select value={String(field.value ?? "lines")} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="lines">{t("workspace.modes.lines")}</SelectItem>
                  <SelectItem value="markers">{t("workspace.modes.markers")}</SelectItem>
                  <SelectItem value="lines+markers">{t("workspace.modes.linesMarkers")}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="config.connectgaps"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  id="connectGaps"
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor="connectGaps" className="text-xs font-medium">
                {t("workspace.style.connectGaps")}
              </FormLabel>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="config.line.smoothing"
          render={({ field }) => {
            const smoothing = field.value ?? 0;
            return (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className="text-xs font-medium">
                    {t("workspace.style.smoothing")}
                  </FormLabel>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {Math.round(smoothing * 100)}%
                  </Badge>
                </div>
                <FormControl>
                  <Slider
                    min={0}
                    max={1}
                    step={0.05}
                    value={[smoothing]}
                    onValueChange={(values) => field.onChange(values[0])}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />
      </section>
    </div>
  );
}
