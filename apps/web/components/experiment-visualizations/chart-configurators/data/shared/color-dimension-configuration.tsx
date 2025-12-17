"use client";

import React from "react";
import type { UseFormReturn } from "react-hook-form";

import type { ExperimentTableMetadata } from "@repo/api";
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
  table: ExperimentTableMetadata;
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
        "linear-gradient(to right, #440154, #48186a, #472d7b, #424086, #3b528b, #33638d, #2c728e, #26828e, #21918c, #1fa088, #28ae80, #3fbc73, #5ec962, #84d44b, #addc30, #d8e219, #fde725)",
    },
    {
      value: "Cividis",
      translationKey: "cividis",
      gradient:
        "linear-gradient(to right, rgb(0,32,76), rgb(0,42,102), rgb(0,52,110), rgb(39,63,108), rgb(60,74,107), rgb(76,85,107), rgb(91,95,109), rgb(104,106,112), rgb(117,117,117), rgb(131,129,120), rgb(146,140,120), rgb(161,152,118), rgb(176,165,114), rgb(192,177,109), rgb(209,191,102), rgb(225,204,92), rgb(243,219,79), rgb(255,233,69))",
    },
    {
      value: "Blues",
      translationKey: "blues",
      gradient:
        "linear-gradient(to right, rgb(5,10,172), rgb(40,60,190), rgb(70,100,245), rgb(90,120,245), rgb(106,137,247), rgb(220,220,220))",
    },
    {
      value: "Reds",
      translationKey: "reds",
      gradient:
        "linear-gradient(to right, rgb(220,220,220), rgb(245,195,157), rgb(245,160,105), rgb(178,10,28))",
    },
    {
      value: "Greens",
      translationKey: "greens",
      gradient:
        "linear-gradient(to right, rgb(0,68,27), rgb(0,109,44), rgb(35,139,69), rgb(65,171,93), rgb(116,196,118), rgb(161,217,155), rgb(199,233,192), rgb(229,245,224), rgb(247,252,245))",
    },
    {
      value: "Greys",
      translationKey: "greys",
      gradient: "linear-gradient(to right, rgb(0,0,0), rgb(255,255,255))",
    },
    {
      value: "YlGnBu",
      translationKey: "ylgnbu",
      gradient:
        "linear-gradient(to right, rgb(8,29,88), rgb(37,52,148), rgb(34,94,168), rgb(29,145,192), rgb(65,182,196), rgb(127,205,187), rgb(199,233,180), rgb(237,248,217), rgb(255,255,217))",
    },
    {
      value: "YlOrRd",
      translationKey: "ylord",
      gradient:
        "linear-gradient(to right, rgb(128,0,38), rgb(189,0,38), rgb(227,26,28), rgb(252,78,42), rgb(253,141,60), rgb(254,178,76), rgb(254,217,118), rgb(255,237,160), rgb(255,255,204))",
    },
    {
      value: "RdBu",
      translationKey: "rdbu",
      gradient:
        "linear-gradient(to right, rgb(5,10,172), rgb(106,137,247), rgb(190,190,190), rgb(220,170,132), rgb(230,145,90), rgb(178,10,28))",
    },
    {
      value: "Picnic",
      translationKey: "picnic",
      gradient:
        "linear-gradient(to right, rgb(0,0,255), rgb(51,153,255), rgb(102,204,255), rgb(153,204,255), rgb(204,204,255), rgb(255,255,255), rgb(255,204,255), rgb(255,153,255), rgb(255,102,204), rgb(255,102,102), rgb(255,0,0))",
    },
    {
      value: "Rainbow",
      translationKey: "rainbow",
      gradient:
        "linear-gradient(to right, rgb(150,0,90), rgb(0,0,200), rgb(0,25,255), rgb(0,152,255), rgb(44,255,150), rgb(151,255,0), rgb(255,234,0), rgb(255,111,0), rgb(255,0,0))",
    },
    {
      value: "Portland",
      translationKey: "portland",
      gradient:
        "linear-gradient(to right, rgb(12,51,131), rgb(10,136,186), rgb(242,211,56), rgb(242,143,56), rgb(217,30,30))",
    },
    {
      value: "Jet",
      translationKey: "jet",
      gradient:
        "linear-gradient(to right, rgb(0,0,131), rgb(0,60,170), rgb(5,255,255), rgb(255,255,0), rgb(250,0,0), rgb(128,0,0))",
    },
    {
      value: "Hot",
      translationKey: "hot",
      gradient:
        "linear-gradient(to right, rgb(0,0,0), rgb(230,0,0), rgb(255,210,0), rgb(255,255,255))",
    },
    {
      value: "Blackbody",
      translationKey: "blackbody",
      gradient:
        "linear-gradient(to right, rgb(0,0,0), rgb(230,0,0), rgb(230,210,0), rgb(255,255,255), rgb(160,200,255))",
    },
    {
      value: "Earth",
      translationKey: "earth",
      gradient:
        "linear-gradient(to right, rgb(0,0,130), rgb(0,180,180), rgb(40,210,40), rgb(230,230,50), rgb(120,70,20), rgb(255,255,255))",
    },
    {
      value: "Electric",
      translationKey: "electric",
      gradient:
        "linear-gradient(to right, rgb(0,0,0), rgb(30,0,100), rgb(120,0,100), rgb(160,90,0), rgb(230,200,0), rgb(255,250,220))",
    },
    {
      value: "Bluered",
      translationKey: "bluered",
      gradient: "linear-gradient(to right, rgb(0,0,255), rgb(255,0,0))",
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

    // If a column is selected (not "none" and not empty), add new color data source
    if (value !== "none" && value !== "") {
      const tableName = form.watch("dataConfig.tableName");

      appendDataSource({
        tableName: tableName || "",
        columnName: value,
        role: "color",
        alias: "",
      });

      // Auto-fill color axis title with the selected column name
      const currentColorAxisTitle = form.getValues("config.marker.colorbar.title.text");
      if (!currentColorAxisTitle) {
        form.setValue("config.marker.colorbar.title.text", value);
      }
    } else {
      // Clear color axis title when no color is selected
      form.setValue("config.marker.colorbar.title.text", "");
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
              {table.columns?.map((column) => (
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
                            {t(`configuration.colorscales.${colorscale.translationKey}`)}
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
              name="config.marker.colorbar.title.text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("configuration.axes.title")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("configuration.chart.enterColorAxisTitle")}
                      className="h-10 bg-white"
                      value={field.value}
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
