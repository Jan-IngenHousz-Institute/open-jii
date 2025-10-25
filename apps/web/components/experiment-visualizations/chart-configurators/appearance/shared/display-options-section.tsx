"use client";

import { Eye } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import { useTranslation } from "@repo/i18n";
import {
  Checkbox,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@repo/ui/components";

import type { ChartFormValues } from "../../chart-configurator-util";

interface DisplayOptionsSectionProps {
  form: UseFormReturn<ChartFormValues>;
}

export default function DisplayOptionsSection({ form }: DisplayOptionsSectionProps) {
  const { t } = useTranslation("experimentVisualizations");

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <Eye className="text-primary h-5 w-5" />
        <h3 className="text-lg font-semibold">{t("configuration.chartOptions.displayOptions")}</h3>
      </div>

      {/* Display Options Fields */}
      <div className="grid grid-cols-1 gap-6">
        {/* Chart Title */}
        <FormField
          control={form.control}
          name="config.title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">
                {t("configuration.chartOptions.title")}
              </FormLabel>
              <FormControl>
                <Input
                  placeholder={t("configuration.placeholders.enterChartTitle")}
                  className="h-10 bg-white"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Show Legend */}
        <FormField
          control={form.control}
          name="config.showLegend"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
              <FormControl>
                <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="text-sm font-medium">
                {t("configuration.chartOptions.showLegend")}
              </FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Show Grid */}
        <FormField
          control={form.control}
          name="config.showGrid"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
              <FormControl>
                <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="text-sm font-medium">
                {t("configuration.chartOptions.gridLines")}
              </FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
