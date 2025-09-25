"use client";

import type { SampleTable } from "@/hooks/experiment/useExperimentData/useExperimentData";
import { useExperimentVisualizationUpdate } from "@/hooks/experiment/useExperimentVisualizationUpdate/useExperimentVisualizationUpdate";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useForm } from "react-hook-form";

import type { ChartType, ExperimentVisualization } from "@repo/api";
import { zUpdateExperimentVisualizationBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Textarea,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import ChartConfigurator, {
  collectAllChartDataSources,
} from "./chart-configurators/chart-configurator";
import type { ChartFormValues } from "./chart-configurators/types";

interface EditVisualizationFormProps {
  experimentId: string;
  visualization: ExperimentVisualization;
  sampleTables: SampleTable[];
  onSuccess: (visualizationId: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function EditVisualizationForm({
  experimentId,
  visualization,
  sampleTables,
  onSuccess,
  onCancel,
  isLoading: isLoadingTables = false,
}: EditVisualizationFormProps) {
  const { t } = useTranslation("experimentVisualizations");
  const { t: tCommon } = useTranslation("common");
  const [selectedChartType, setSelectedChartType] = useState<ChartType | null>(
    visualization.chartType,
  );

  // Form setup with existing visualization data
  const form = useForm({
    resolver: zodResolver(zUpdateExperimentVisualizationBody),
    defaultValues: {
      name: visualization.name,
      description: visualization.description ?? "",
      chartFamily: visualization.chartFamily,
      chartType: visualization.chartType,
      config: visualization.config,
      dataConfig: visualization.dataConfig,
    },
  });

  // Update visualization mutation
  const { mutate: updateVisualization, isPending } = useExperimentVisualizationUpdate({
    experimentId,
    onSuccess: (updatedVisualization) => {
      toast({ description: t("updateSuccess") });
      onSuccess(updatedVisualization.id);
    },
  });

  // Use the imported collectAllChartDataSources function
  const collectAllDataSources = () => {
    return collectAllChartDataSources(form as UseFormReturn<ChartFormValues>);
  };

  // Handle form submission
  const onSubmit = form.handleSubmit(
    (data) => {
      // Explicitly collect all data sources before submission
      const allDataSources = collectAllDataSources();

      const updatedData = {
        ...data,
        dataConfig: {
          ...data.dataConfig,
          dataSources: allDataSources,
        },
      };

      updateVisualization({
        params: {
          id: experimentId,
          visualizationId: visualization.id,
        },
        body: updatedData,
      });
    },
    () => {
      // Show a toast with validation error info
      toast({
        description:
          "Please fill in all required fields. You need to select columns for your chart axes.",
        title: "Validation Error",
        variant: "destructive",
      });
    },
  );

  // Handle chart type selection
  const handleChartTypeSelect = (chartType: ChartType) => {
    setSelectedChartType(chartType);
    form.setValue("chartType", chartType);

    // Initialize config based on chart type and selected table
    const selectedTableName =
      form.getValues("dataConfig.tableName") ||
      (sampleTables.length > 0 ? sampleTables[0].name : "");

    switch (chartType) {
      case "line":
        form.setValue("config", {
          chartType: "line",
          config: {
            xAxis: {
              type: "linear",
              dataSource: { tableName: selectedTableName, columnName: "" },
              title: "",
            },
            yAxes: [
              {
                type: "linear",
                dataSource: { tableName: selectedTableName, columnName: "", alias: "" },
                title: "",
                side: "left",
                color: "#3b82f6",
              },
            ],
            mode: "lines",
            connectGaps: true,
            smoothing: 0,
            gridLines: "both",
            display: {
              title: "",
              showLegend: true,
              legendPosition: "right",
              colorScheme: "default",
              interactive: true,
            },
          },
        });
        form.setValue("dataConfig", {
          tableName: selectedTableName,
          dataSources: [{ tableName: selectedTableName, columnName: "", alias: "" }],
        });
        break;

      case "scatter":
        form.setValue("config", {
          chartType: "scatter",
          config: {
            xAxis: {
              type: "linear",
              dataSource: { tableName: selectedTableName, columnName: "" },
              title: "",
            },
            yAxes: [
              {
                type: "linear",
                dataSource: { tableName: selectedTableName, columnName: "", alias: "" },
                title: "",
                side: "left",
                color: "#3b82f6",
              },
            ],
            colorAxis: null,
            mode: "markers",
            markerSize: 6,
            markerShape: "circle",
            colorScale: "Viridis",
            showColorBar: true,
            gridLines: "both",
            display: {
              title: "",
              showLegend: true,
              legendPosition: "right",
              colorScheme: "default",
              interactive: true,
            },
          },
        });
        form.setValue("dataConfig", {
          tableName: selectedTableName,
          dataSources: [{ tableName: selectedTableName, columnName: "", alias: "" }],
        });
        break;

      case "bar":
        form.setValue("config", {
          chartType: "bar",
          config: {
            xAxis: {
              type: "category", // Bar charts typically have categorical x-axis
              dataSource: { tableName: selectedTableName, columnName: "" },
              title: "",
            },
            yAxes: [
              {
                type: "linear", // Bar charts typically have linear y-axis
                dataSource: { tableName: selectedTableName, columnName: "", alias: "" },
                title: "",
                side: "left",
                color: "#3b82f6",
              },
            ],
            orientation: "vertical",
            barMode: "overlay",
            barWidth: 0.7,
            gridLines: "both",
            showValues: false,
            display: {
              title: "",
              showLegend: true,
              legendPosition: "right",
              colorScheme: "default",
              interactive: true,
            },
          },
        });
        form.setValue("dataConfig", {
          tableName: selectedTableName,
          dataSources: [{ tableName: selectedTableName, columnName: "", alias: "" }],
        });
        break;

      case "area":
        form.setValue("config", {
          chartType: "area",
          config: {
            xAxis: {
              type: "linear", // Area charts typically use continuous x-axis (time series, etc.)
              dataSource: { tableName: selectedTableName, columnName: "" },
              title: "",
            },
            yAxes: [
              {
                type: "linear", // Area charts typically use linear y-axis
                dataSource: { tableName: selectedTableName, columnName: "" },
                title: "",
                side: "left",
              },
            ],
            fillMode: "tozeroy",
            fillOpacity: 0.6,
            gridLines: "both",
            smoothing: 0,
            display: {
              title: "",
              showLegend: true,
              legendPosition: "right",
              colorScheme: "default",
              interactive: true,
            },
          },
        });
        form.setValue("dataConfig", {
          tableName: selectedTableName,
          dataSources: [{ tableName: selectedTableName, columnName: "", alias: "" }],
        });
        break;

      case "pie":
        form.setValue("config", {
          chartType: "pie",
          config: {
            labelSource: { tableName: selectedTableName, columnName: "" },
            valueSource: { tableName: selectedTableName, columnName: "" },
            showLabels: true,
            showValues: true,
            hole: 0,
            textPosition: "auto",
            pull: 0,
            display: {
              title: "",
              showLegend: true,
              legendPosition: "right",
              colorScheme: "default",
              interactive: true,
            },
          },
        });
        form.setValue("dataConfig", {
          tableName: selectedTableName,
          dataSources: [{ tableName: selectedTableName, columnName: "", alias: "" }],
        });
        break;

      case "dot-plot":
        form.setValue("config", {
          chartType: "dot-plot",
          config: {
            xAxis: {
              type: "category", // Dot plots often use categorical x-axis for grouping
              dataSource: { tableName: selectedTableName, columnName: "" },
              title: "",
            },
            yAxes: [
              {
                type: "linear", // Dot plots typically use linear y-axis for values
                dataSource: { tableName: selectedTableName, columnName: "", alias: "" },
                title: "",
                side: "left",
                color: "#3b82f6",
              },
            ],
            markerSize: 8,
            markerShape: "circle",
            gridLines: "both",
            display: {
              title: "",
              showLegend: true,
              legendPosition: "right",
              colorScheme: "default",
              interactive: true,
            },
          },
        });
        form.setValue("dataConfig", {
          tableName: selectedTableName,
          dataSources: [{ tableName: selectedTableName, columnName: "", alias: "" }],
        });
        break;

      case "lollipop":
        form.setValue("config", {
          chartType: "lollipop",
          config: {
            xAxis: {
              type: "category",
              dataSource: { tableName: selectedTableName, columnName: "" },
              title: "",
            },
            yAxes: [
              {
                type: "linear",
                dataSource: { tableName: selectedTableName, columnName: "", alias: "" },
                side: "left",
                title: "",
                color: "#3b82f6",
              },
            ],
            orientation: "v",
            stemWidth: 3,
            dotSize: 15,
            gridLines: "both",
            display: {
              title: "",
              showLegend: true,
              legendPosition: "right",
              colorScheme: "default",
              interactive: true,
            },
          },
        });
        form.setValue("dataConfig", {
          tableName: selectedTableName,
          dataSources: [{ tableName: selectedTableName, columnName: "", alias: "" }],
        });
        break;

      case "bubble":
        form.setValue("config", {
          chartType: "bubble",
          config: {
            xAxis: {
              type: "linear",
              dataSource: { tableName: selectedTableName, columnName: "" },
              title: "",
            },
            yAxes: [
              {
                type: "linear",
                dataSource: { tableName: selectedTableName, columnName: "", alias: "" },
                side: "left",
                title: "",
                color: "#3b82f6",
              },
            ],
            sizeAxis: {
              type: "linear",
              dataSource: { tableName: selectedTableName, columnName: "" },
              title: "",
            },
            mode: "markers",
            markerSizeScale: {
              min: 5,
              max: 50,
            },
            markerShape: "circle",
            opacity: 0.8,
            gridLines: "both",
            display: {
              title: "",
              showLegend: true,
              legendPosition: "right",
              colorScheme: "default",
              interactive: true,
            },
          },
        });
        form.setValue("dataConfig", {
          tableName: selectedTableName,
          dataSources: [{ tableName: selectedTableName, columnName: "", alias: "" }],
        });
        break;

      case "box-plot":
        form.setValue("config", {
          chartType: "box-plot",
          config: {
            xAxis: {
              type: "category",
              dataSource: { tableName: selectedTableName, columnName: "" },
              title: "",
            },
            yAxes: [
              {
                type: "linear",
                dataSource: { tableName: selectedTableName, columnName: "", alias: "" },
                side: "left",
                title: "",
                color: "#3b82f6",
              },
            ],
            orientation: "v",
            boxMode: "group",
            boxPoints: "outliers",
            notched: false,
            boxMean: "false",
            jitter: 0.3,
            pointPos: -1.8,
            notchWidth: 0.25,
            markerSize: 6,
            lineWidth: 2,
            fillOpacity: 0.5,
            gridLines: "both",
            display: {
              title: "",
              showLegend: true,
              legendPosition: "right",
              colorScheme: "default",
              interactive: true,
            },
          },
        });
        form.setValue("dataConfig", {
          tableName: selectedTableName,
          dataSources: [{ tableName: selectedTableName, columnName: "", alias: "" }],
        });
        break;

      case "histogram":
        form.setValue("config", {
          chartType: "histogram",
          config: {
            series: [
              {
                dataSource: { tableName: selectedTableName, columnName: "", alias: "" },
                name: "Series 1",
                color: "#3b82f6",
                opacity: 0.7,
              },
            ],
            nbins: 20,
            autobinx: true,
            orientation: "v",
            barmode: "overlay",
            gridLines: "both",
            display: {
              title: "",
              showLegend: true,
              legendPosition: "right",
              colorScheme: "default",
              interactive: true,
            },
          },
        });
        form.setValue("dataConfig", {
          tableName: selectedTableName,
          dataSources: [{ tableName: selectedTableName, columnName: "", alias: "" }],
        });
        break;

      case "heatmap":
        form.setValue("config", {
          chartType: "heatmap",
          config: {
            xAxis: {
              type: "category",
              dataSource: { tableName: selectedTableName, columnName: "" },
              title: "",
            },
            yAxis: {
              type: "category",
              dataSource: { tableName: selectedTableName, columnName: "" },
              title: "",
            },
            zAxis: {
              type: "linear",
              dataSource: { tableName: selectedTableName, columnName: "" },
              title: "",
            },
            colorscale: "Viridis",
            showScale: true,
            showText: false,
            connectGaps: true,
            textTemplate: "%{z}",
            textFont: {
              color: "white",
              size: 12,
            },
            colorbarTitle: "",
            display: {
              title: "",
              showLegend: false,
              legendPosition: "right",
              colorScheme: "default",
              interactive: true,
            },
          },
        });
        form.setValue("dataConfig", {
          tableName: selectedTableName,
          dataSources: [{ tableName: selectedTableName, columnName: "", alias: "" }],
        });
        break;

      case "contour":
        form.setValue("config", {
          chartType: "contour",
          config: {
            xAxis: {
              type: "linear",
              dataSource: { tableName: selectedTableName, columnName: "" },
              title: "",
            },
            yAxis: {
              type: "linear",
              dataSource: { tableName: selectedTableName, columnName: "" },
              title: "",
            },
            zAxis: {
              type: "linear",
              dataSource: { tableName: selectedTableName, columnName: "" },
              title: "",
            },
            colorscale: "Viridis",
            showScale: true,
            colorbarTitle: "",
            contours: {
              coloring: "lines",
              showlines: true,
              showlabels: true,
              labelfont: {
                size: 12,
                color: "black",
              },
            },
            ncontours: 15,
            autocontour: true,
            connectgaps: false,
            smoothing: 1,
            display: {
              title: "",
              showLegend: false,
              legendPosition: "right",
              colorScheme: "default",
              interactive: true,
            },
          },
        });
        form.setValue("dataConfig", {
          tableName: selectedTableName,
          dataSources: [{ tableName: selectedTableName, columnName: "", alias: "" }],
        });
        break;

      case "ternary":
        form.setValue("config", {
          chartType: "ternary",
          config: {
            aAxis: {
              type: "linear",
              dataSource: { tableName: selectedTableName, columnName: "" },
              title: "Component A",
            },
            bAxis: {
              type: "linear",
              dataSource: { tableName: selectedTableName, columnName: "" },
              title: "Component B",
            },
            cAxis: {
              type: "linear",
              dataSource: { tableName: selectedTableName, columnName: "" },
              title: "Component C",
            },
            aAxisProps: {
              title: "Component A",
              showgrid: true,
              showline: true,
              showticklabels: true,
              gridcolor: "#E6E6E6",
              linecolor: "#444",
            },
            bAxisProps: {
              title: "Component B",
              showgrid: true,
              showline: true,
              showticklabels: true,
              gridcolor: "#E6E6E6",
              linecolor: "#444",
            },
            cAxisProps: {
              title: "Component C",
              showgrid: true,
              showline: true,
              showticklabels: true,
              gridcolor: "#E6E6E6",
              linecolor: "#444",
            },
            sum: 100,
            mode: "markers",
            boundaries: [],
            bgcolor: "white",
            display: {
              title: "",
              showLegend: true,
              legendPosition: "right",
              colorScheme: "default",
              interactive: true,
            },
          },
        });
        form.setValue("dataConfig", {
          tableName: selectedTableName,
          dataSources: [{ tableName: selectedTableName, columnName: "", alias: "" }],
        });
        break;

      case "correlation-matrix":
        form.setValue("config", {
          chartType: "correlation-matrix",
          config: {
            variables: [
              {
                tableName: selectedTableName,
                columnName: "",
                alias: "",
              },
              {
                tableName: selectedTableName,
                columnName: "",
                alias: "",
              },
            ],
            colorscale: "Viridis",
            showValues: true,
            showScale: true,
            colorbarTitle: "",
            display: {
              title: "",
              showLegend: false,
              legendPosition: "right",
              colorScheme: "default",
              interactive: true,
            },
          },
        });
        form.setValue("dataConfig", {
          tableName: selectedTableName,
          dataSources: [{ tableName: selectedTableName, columnName: "", alias: "" }],
        });
        break;

      case "parallel-coordinates":
        form.setValue("config", {
          chartType: "parallel-coordinates",
          config: {
            dimensions: [
              {
                dataSource: {
                  tableName: selectedTableName,
                  columnName: "",
                  alias: "",
                },
                label: "",
                visible: true,
                multiselect: true,
              },
            ],
            line: {
              color: "#3b82f6",
              colorscale: "Viridis",
              width: 1,
              opacity: 1,
              showscale: true,
            },
            labelside: "top",
            labelangle: 0,
            display: {
              title: "",
              showLegend: true,
              legendPosition: "right",
              colorScheme: "default",
            },
          },
        });
        form.setValue("dataConfig", {
          tableName: selectedTableName,
          dataSources: [{ tableName: selectedTableName, columnName: "", alias: "" }],
        });
        break;

      case "log-plot":
        form.setValue("config", {
          chartType: "log-plot",
          config: {
            xAxis: {
              type: "linear",
              dataSource: { tableName: selectedTableName, columnName: "" },
              title: "",
            },
            yAxes: [
              {
                type: "log",
                dataSource: { tableName: selectedTableName, columnName: "", alias: "" },
                side: "left",
                title: "",
                color: "#3b82f6",
                mode: "markers",
                marker: {
                  size: 8,
                  symbol: "circle",
                },
              },
            ],
            gridLines: "both",
            display: {
              title: "",
              showLegend: true,
              legendPosition: "right",
              colorScheme: "default",
              interactive: true,
            },
          },
        });
        form.setValue("dataConfig", {
          tableName: selectedTableName,
          dataSources: [{ tableName: selectedTableName, columnName: "", alias: "" }],
        });
        break;

      case "radar":
        form.setValue("config", {
          chartType: "radar",
          config: {
            categoryAxis: {
              dataSource: { tableName: selectedTableName, columnName: "" },
              title: "",
            },
            series: [
              {
                dataSource: { tableName: selectedTableName, columnName: "", alias: "" },
                name: "Series 1",
                color: "#3b82f6",
                fill: "toself",
                mode: "lines+markers",
                opacity: 0.6,
                line: {
                  width: 2,
                  dash: "solid",
                },
                marker: {
                  size: 6,
                  symbol: "circle",
                },
              },
            ],
            rangeMode: "normal",
            gridShape: "circular",
            tickAngle: 0,
            showTickLabels: true,
            radialAxisVisible: true,
            angularAxisVisible: true,
            display: {
              title: "",
              showLegend: true,
              legendPosition: "right",
              colorScheme: "default",
              interactive: true,
            },
          },
        });
        form.setValue("dataConfig", {
          tableName: selectedTableName,
          dataSources: [{ tableName: selectedTableName, columnName: "", alias: "" }],
        });
        break;

      default:
        // For chart types that don't have configurators yet, fall back to line chart config
        form.setValue("config", {
          chartType: "line",
          config: {
            xAxis: {
              type: "linear",
              dataSource: { tableName: selectedTableName, columnName: "" },
            },
            yAxes: [
              {
                type: "linear",
                dataSource: { tableName: selectedTableName, columnName: "" },
                side: "left",
              },
            ],
            mode: "lines",
            connectGaps: true,
            smoothing: 0,
            gridLines: "both",
            display: {
              title: "",
              showLegend: true,
              legendPosition: "right",
              colorScheme: "default",
              interactive: true,
            },
          },
        });
        form.setValue("dataConfig", {
          tableName: selectedTableName,
          dataSources: [{ tableName: selectedTableName, columnName: "", alias: "" }],
        });
        break;
    }
  };

  if (isLoadingTables) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-8">
        {/* Name and Description */}
        <Card>
          <CardHeader>
            <CardTitle>{t("editDetails")}</CardTitle>
            <CardDescription>{t("editDetailsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("name")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("namePlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("description")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("descriptionPlaceholder")}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormDescription>{t("descriptionHelp")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Chart Configuration - using the new modular approach */}
        <ChartConfigurator
          form={form as UseFormReturn<ChartFormValues>}
          tables={sampleTables}
          selectedChartType={selectedChartType}
          onChartTypeSelect={handleChartTypeSelect}
        />

        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={onCancel}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" disabled={isPending || !selectedChartType}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {tCommon("updating")}
              </>
            ) : (
              tCommon("update")
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
