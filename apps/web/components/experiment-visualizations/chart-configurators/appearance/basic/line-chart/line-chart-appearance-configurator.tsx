"use client";

import { LineChart } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import { useTranslation } from "@repo/i18n";
import {
  Badge,
  Checkbox,
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
  Slider,
} from "@repo/ui/components";

import type { ChartFormValues } from "../../../chart-configurator-util";
import DisplayOptionsSection from "../../shared/display-options-section";

interface LineChartAppearanceConfiguratorProps {
  form: UseFormReturn<ChartFormValues>;
}

export default function LineChartAppearanceConfigurator({
  form,
}: LineChartAppearanceConfiguratorProps) {
  const { t } = useTranslation("experimentVisualizations");

  return (
    <div className="space-y-8">
      {/* Line Chart Appearance & Options */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Display Options */}
        <DisplayOptionsSection form={form} />

        {/* Line Chart Options */}
        <div className="space-y-4">
          {/* Section Header */}
          <div className="flex items-center gap-2">
            <LineChart className="text-primary h-5 w-5" />
            <h3 className="text-lg font-semibold">
              {t("configuration.chartOptions.lineChartOptions")}
            </h3>
          </div>

          {/* Line Chart Options Fields */}
          <div className="grid grid-cols-1 gap-6">
            <FormField
              control={form.control}
              name="config.mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("configuration.chartOptions.mode")}
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-10 bg-white">
                        <SelectValue placeholder={t("configuration.placeholders.selectLineMode")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="lines">{t("configuration.modes.lines")}</SelectItem>
                      <SelectItem value="markers">{t("configuration.modes.markers")}</SelectItem>
                      <SelectItem value="lines+markers">
                        {t("configuration.modes.linesMarkers")}
                      </SelectItem>
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
                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="text-sm font-medium">
                    {t("configuration.chartOptions.connectGaps")}
                  </FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.line.smoothing"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("configuration.chartOptions.smoothing")}
                  </FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      <Slider
                        min={0}
                        max={1}
                        step={0.05}
                        value={[field.value ?? 0]}
                        onValueChange={(values) => field.onChange(values[0])}
                        className="w-full"
                      />
                      <div className="flex items-center justify-center">
                        <Badge variant="outline" className="font-mono text-xs">
                          {Math.round((field.value ?? 0) * 100)}%
                        </Badge>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
