"use client";

import React from "react";
import type { UseFormReturn } from "react-hook-form";
import type { SampleTable } from "~/hooks/experiment/useExperimentData/useExperimentData";

import { useTranslation } from "@repo/i18n";
import {
  Badge,
  Checkbox,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components";

import type { ChartFormValues } from "../../chart-configurator-util";

interface ColorDimensionConfigurationProps {
  form: UseFormReturn<ChartFormValues>;
  table: SampleTable;
  colorAxisDataSources: { field: { columnName: string; role: string }; index: number }[];
  appendDataSource: (dataSource: {
    tableName: string;
    columnName: string;
    role: string;
    alias: string;
  }) => void;
  removeDataSource: (index: number) => void;
}

export default function ColorDimensionConfiguration({
  form,
  table,
  colorAxisDataSources,
  appendDataSource,
  removeDataSource,
}: ColorDimensionConfigurationProps) {
  const { t } = useTranslation("experimentVisualizations");

  // Define colorscales with their gradients and translation keys
  const colorscales = [
    {
      value: "Viridis",
      translationKey: "viridis",
      gradient:
        "linear-gradient(to right, #440154, #482878, #3e4989, #31688e, #26828e, #1f9e89, #35b779, #6ece58, #b5de2b, #fde725)",
    },
    {
      value: "Plasma",
      translationKey: "plasma",
      gradient:
        "linear-gradient(to right, #0d0887, #46039f, #7201a8, #9c179e, #bd3786, #d8576b, #ed7953, #fb9f3a, #fdca26, #f0f921)",
    },
    {
      value: "Inferno",
      translationKey: "inferno",
      gradient:
        "linear-gradient(to right, #000004, #1b0c41, #4a0c6b, #781c6d, #a52c60, #cf4446, #ed6925, #fb9b06, #f7d13d, #fcffa4)",
    },
    {
      value: "Magma",
      translationKey: "magma",
      gradient:
        "linear-gradient(to right, #000004, #180f3d, #440f76, #721f81, #9e2f7f, #cd4071, #f1605d, #fd9567, #feca57, #fcfdbf)",
    },
    {
      value: "Cividis",
      translationKey: "cividis",
      gradient:
        "linear-gradient(to right, #00224e, #123570, #3b496c, #575d6d, #707173, #8a8678, #a59c74, #c3b369, #e1cc55, #fde725)",
    },
    {
      value: "Blues",
      translationKey: "blues",
      gradient:
        "linear-gradient(to right, #f7fbff, #deebf7, #c6dbef, #9ecae1, #6baed6, #4292c6, #2171b5, #08519c, #08306b)",
    },
    {
      value: "Greens",
      translationKey: "greens",
      gradient:
        "linear-gradient(to right, #f7fcf5, #e5f5e0, #c7e9c0, #a1d99b, #74c476, #41ab5d, #238b45, #006d2c, #00441b)",
    },
    {
      value: "Reds",
      translationKey: "reds",
      gradient:
        "linear-gradient(to right, #fff5f0, #fee0d2, #fcbba1, #fc9272, #fb6a4a, #ef3b2c, #cb181d, #a50f15, #67000d)",
    },
    {
      value: "Oranges",
      translationKey: "oranges",
      gradient:
        "linear-gradient(to right, #fff5eb, #fee6ce, #fdd0a2, #fdae6b, #fd8d3c, #f16913, #d94801, #a63603, #7f2704)",
    },
    {
      value: "Purples",
      translationKey: "purples",
      gradient:
        "linear-gradient(to right, #fcfbfd, #efedf5, #dadaeb, #bcbddc, #9e9ac8, #807dba, #6a51a3, #54278f, #3f007d)",
    },
    {
      value: "Greys",
      translationKey: "greys",
      gradient:
        "linear-gradient(to right, #ffffff, #f0f0f0, #d9d9d9, #bdbdbd, #969696, #737373, #525252, #252525, #000000)",
    },
    {
      value: "Hot",
      translationKey: "hot",
      gradient: "linear-gradient(to right, #000000, #ff0000, #ffff00, #ffffff)",
    },
    {
      value: "Cool",
      translationKey: "cool",
      gradient: "linear-gradient(to right, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff)",
    },
    {
      value: "Rainbow",
      translationKey: "rainbow",
      gradient:
        "linear-gradient(to right, #ff0000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff)",
    },
    {
      value: "Jet",
      translationKey: "jet",
      gradient:
        "linear-gradient(to right, #000080, #0000ff, #0080ff, #00ffff, #80ff00, #ffff00, #ff8000, #ff0000, #800000)",
    },
  ];

  // Get colorscale gradient based on colorscales array
  const getColorscaleGradient = (colorscale: string): string => {
    const found = colorscales.find((cs) => cs.value === colorscale);
    return found?.gradient ?? colorscales[0].gradient; // Default to Viridis
  };

  // Handle color column selection
  const handleColorColumnChange = (value: string) => {
    // Always remove existing color data source first
    if (colorAxisDataSources[0]) {
      removeDataSource(colorAxisDataSources[0].index);
    }

    // If a column is selected (not "none"), add new color data source
    if (value !== "none") {
      const tableName = form.watch("dataConfig.tableName");
      appendDataSource({
        tableName: tableName || "",
        columnName: value,
        role: "color",
        alias: "",
      });

      // Auto-fill color axis title with the selected column name
      const currentColorAxisTitle = form.getValues("config.colorAxisTitle");
      if (!currentColorAxisTitle || currentColorAxisTitle === "") {
        form.setValue("config.colorAxisTitle", value);
      }
    }
  };

  return (
    <div className="space-y-6 pt-6">
      {/* Section Header */}
      <div className="font-semibold leading-none tracking-tight">
        {t("configuration.color.dimensionConfig")}
      </div>

      {/* Row 1: Color Column + Show Colorbar Checkbox */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <FormLabel className="text-sm font-medium">{t("configuration.columns.color")}</FormLabel>
          <Select
            value={colorAxisDataSources[0]?.field.columnName}
            onValueChange={handleColorColumnChange}
          >
            <SelectTrigger className="h-10 bg-white">
              <SelectValue placeholder={t("configuration.columns.selectColor")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <span className="text-muted-foreground italic">
                  {t("configuration.columns.noColorMapping")}
                </span>
              </SelectItem>
              {table.columns.map((column) => (
                <SelectItem key={column.name} value={column.name}>
                  <div className="flex items-center gap-2">
                    <span>{column.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {column.type_name}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Show Color Bar Checkbox - only show when colorAxis is configured */}
        {colorAxisDataSources.length > 0 && colorAxisDataSources[0]?.field.columnName && (
          <div className="flex flex-col justify-end">
            <FormField
              control={form.control}
              name="config.marker.showscale"
              render={({ field }) => (
                <FormItem className="flex h-10 flex-row items-center space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="text-sm font-medium">
                    {t("configuration.chart.showColorbar")}
                  </FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
      </div>

      {/* Color Configuration - only show when colorAxis is configured */}
      {colorAxisDataSources.length > 0 && colorAxisDataSources[0]?.field.columnName && (
        <div className="space-y-6">
          {/* Row 2: Color Scale + Axis Title + Position (33% each) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <FormField
              control={form.control}
              name="config.marker.colorscale"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("configuration.color.scale")}
                  </FormLabel>
                  <Select value={field.value as string} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-10 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {colorscales.map((colorscale) => (
                        <SelectItem key={colorscale.value} value={colorscale.value}>
                          <div className="flex items-center gap-3">
                            <div
                              className="h-4 w-8 rounded border"
                              style={{
                                background: colorscale.gradient,
                              }}
                            />
                            {t(`colorscales.${colorscale.translationKey}`)}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.colorAxisTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("configuration.axes.title")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("configuration.chart.enterColorAxisTitle")}
                      className="h-10 bg-white"
                      value={field.value as string}
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

            <FormField
              control={form.control}
              name="config.marker.colorbar.title.side"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("configuration.axes.titlePosition")}
                  </FormLabel>
                  <Select value={String(field.value)} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-10 bg-white">
                        <SelectValue placeholder={t("configuration.chart.selectPosition")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="top">{t("configuration.positions.top")}</SelectItem>
                      <SelectItem value="right">{t("configuration.positions.right")}</SelectItem>
                      <SelectItem value="bottom">{t("configuration.positions.bottom")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Color Scale Preview */}
          <div>
            <div className="text-muted-foreground mb-2 text-xs">{t("preview.title")}</div>
            <div
              className="h-6 w-full rounded border"
              style={{
                background: getColorscaleGradient(form.watch("config.marker.colorscale") as string),
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
