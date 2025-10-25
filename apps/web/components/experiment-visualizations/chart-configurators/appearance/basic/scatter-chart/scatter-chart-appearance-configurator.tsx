"use client";

import { ScatterChart } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import { useTranslation } from "@repo/i18n";
import {
  Badge,
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

interface ScatterChartAppearanceConfiguratorProps {
  form: UseFormReturn<ChartFormValues>;
}

export default function ScatterChartAppearanceConfigurator({
  form,
}: ScatterChartAppearanceConfiguratorProps) {
  const { t } = useTranslation("experimentVisualizations");

  return (
    <div className="space-y-8">
      {/* Scatter Chart Appearance & Options */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Display Options */}
        <DisplayOptionsSection form={form} />

        {/* Scatter Chart Options */}
        <div className="space-y-4">
          {/* Section Header */}
          <div className="flex items-center gap-2">
            <ScatterChart className="text-primary h-5 w-5" />
            <h3 className="text-lg font-semibold">
              {t("configuration.chartOptions.scatterChartOptions")}
            </h3>
          </div>

          {/* Scatter Chart Options Fields */}
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
                        <SelectValue
                          placeholder={t("configuration.placeholders.selectScatterMode")}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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
              name="config.marker.size"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("configuration.chartOptions.markerSize")}
                  </FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      <Slider
                        min={1}
                        max={20}
                        step={1}
                        value={[field.value as number]}
                        onValueChange={(values) => field.onChange(values[0])}
                        className="w-full"
                      />
                      <div className="flex items-center justify-center">
                        <Badge variant="outline" className="font-mono text-xs">
                          {Number(field.value)}px
                        </Badge>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.marker.symbol"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("configuration.chartOptions.markerShape")}
                  </FormLabel>
                  <Select value={field.value as string} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-10 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="circle">
                        {t("configuration.markerSymbols.circle")}
                      </SelectItem>
                      <SelectItem value="square">
                        {t("configuration.markerSymbols.square")}
                      </SelectItem>
                      <SelectItem value="diamond">
                        {t("configuration.markerSymbols.diamond")}
                      </SelectItem>
                      <SelectItem value="cross">
                        {t("configuration.markerSymbols.cross")}
                      </SelectItem>
                      <SelectItem value="x">{t("configuration.markerSymbols.x")}</SelectItem>
                    </SelectContent>
                  </Select>
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
