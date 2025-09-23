"use client";

import { LineChart, BarChart3, PieChart } from "lucide-react";
import type { ReactNode } from "react";

import type { ChartFamily, ChartType } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { RadioGroup, RadioGroupItem, FormItem, FormControl, FormLabel } from "@repo/ui/components";

interface ChartTypeSelectorProps {
  family: ChartFamily;
  selectedChartType: ChartType | null;
  onChartTypeSelect: (chartType: ChartType) => void;
}

// Define chart types for each family with icons only
const CHART_TYPES_BY_FAMILY: Record<ChartFamily, { type: ChartType; icon: ReactNode }[]> = {
  basic: [
    { type: "line", icon: <LineChart className="h-5 w-5" /> },
    { type: "bar", icon: <BarChart3 className="h-5 w-5" /> },
    { type: "pie", icon: <PieChart className="h-5 w-5" /> },
    { type: "area", icon: <LineChart className="h-5 w-5" /> },
    { type: "scatter", icon: <BarChart3 className="h-5 w-5" /> },
    { type: "dot-plot", icon: <BarChart3 className="h-5 w-5" /> },
  ],
  scientific: [
    { type: "heatmap", icon: <BarChart3 className="h-5 w-5" /> },
    { type: "contour", icon: <BarChart3 className="h-5 w-5" /> },
    { type: "ternary", icon: <BarChart3 className="h-5 w-5" /> },
    { type: "parallel-coordinates", icon: <BarChart3 className="h-5 w-5" /> },
    { type: "radar", icon: <BarChart3 className="h-5 w-5" /> },
    { type: "polar", icon: <BarChart3 className="h-5 w-5" /> },
    { type: "wind-rose", icon: <BarChart3 className="h-5 w-5" /> },
  ],
  statistical: [
    // To be added
    // { type: "boxplot", label: "Box Plot", icon: <BoxPlot className="h-5 w-5" /> },
    // { type: "histogram", label: "Histogram", icon: <BarChart className="h-5 w-5" /> },
  ],
  "3d": [
    // To be added
    // { type: "scatter3d", label: "3D Scatter", icon: <Scatter3D className="h-5 w-5" /> },
    // { type: "surface", label: "Surface Plot", icon: <Surface className="h-5 w-5" /> },
  ],
};

export default function ChartTypeSelector({
  family,
  selectedChartType,
  onChartTypeSelect,
}: ChartTypeSelectorProps) {
  const { t } = useTranslation("experimentVisualizations");
  const availableChartTypes = CHART_TYPES_BY_FAMILY[family];

  if (availableChartTypes.length === 0) {
    return <div className="text-muted-foreground">{t("noChartTypesAvailable")}</div>;
  }

  return (
    <RadioGroup
      value={selectedChartType ?? ""}
      onValueChange={(value) => onChartTypeSelect(value as ChartType)}
      className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
    >
      {availableChartTypes.map((chartType) => (
        <FormItem key={chartType.type}>
          <FormControl>
            <RadioGroupItem value={chartType.type} id={chartType.type} className="peer sr-only" />
          </FormControl>
          <FormLabel
            htmlFor={chartType.type}
            className="border-muted hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary flex flex-col items-center justify-between rounded-md border-2 bg-transparent p-4"
          >
            {chartType.icon}
            <span className="mt-2">{t(`chartTypes.${chartType.type}`)}</span>
          </FormLabel>
        </FormItem>
      ))}
    </RadioGroup>
  );
}
