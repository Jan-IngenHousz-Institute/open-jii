"use client";

// Import the SampleTable type from the API
import type { SampleTable } from "@/hooks/experiment/useExperimentData/useExperimentData";
import { useExperimentVisualizationCreate } from "@/hooks/experiment/useExperimentVisualizationCreate/useExperimentVisualizationCreate";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import type { ChartFamily, ChartType, CreateExperimentVisualizationBody } from "@repo/api";
import { zCreateExperimentVisualizationBody } from "@repo/api";
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

// Import components
import ChartConfigurator from "./chart-configurators/chart-configurator";

interface NewVisualizationFormProps {
  experimentId: string;
  sampleTables: SampleTable[];
  onSuccess: (visualizationId: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function NewVisualizationForm({
  experimentId,
  sampleTables,
  onSuccess,
  onCancel,
  isLoading: isLoadingTables = false,
}: NewVisualizationFormProps) {
  const { t } = useTranslation("experimentVisualizations");
  const { t: tCommon } = useTranslation("common");
  const [selectedChartType, setSelectedChartType] = useState<ChartType | null>(null);

  // Form setup
  const form = useForm<CreateExperimentVisualizationBody>({
    resolver: zodResolver(zCreateExperimentVisualizationBody),
    defaultValues: {
      name: "",
      description: "",
      chartFamily: "basic" as ChartFamily,
      chartType: "line" as ChartType,
      config: {
        chartType: "line" as const,
        config: {
          xAxis: {
            dataSource: { tableName: "", columnName: "" },
            type: "linear" as const,
            title: "",
          },
          yAxes: [
            {
              dataSource: { tableName: "", columnName: "", alias: "" },
              type: "linear" as const,
              title: "",
              side: "left" as const,
              color: "#3b82f6",
            },
          ],
          mode: "lines" as const,
          connectGaps: true,
          smoothing: 0,
          gridLines: "both" as const,
        },
      },
      dataConfig: { tableName: "", dataSources: [] },
    },
  });

  // Create visualization mutation
  const { mutate: createVisualization, isPending } = useExperimentVisualizationCreate({
    experimentId,
    onSuccess: (visualization) => {
      toast({ description: t("createSuccess") });
      onSuccess(visualization.id);
    },
  });

  // Handle form submission
  const onSubmit = form.handleSubmit((data) => {
    createVisualization({
      params: { id: experimentId },
      body: data,
    });
  });

  // We no longer need the handleFamilyChange function since we're selecting chart types directly

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
                side: "left",
                title: "",
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
          dataSources: [],
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
                side: "left",
                title: "",
                color: "#3b82f6",
              },
            ],
            // Color dimension configuration (optional)
            colorAxis: undefined,
            mode: "markers" as const,
            markerSize: 6,
            markerShape: "circle" as const,
            // Color mapping options
            colorScale: "viridis" as const,
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
          dataSources: [],
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
                side: "left",
                title: "",
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
          dataSources: [],
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
                side: "left",
                title: "",
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
          dataSources: [],
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
          dataSources: [],
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
                side: "left",
                title: "",
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
          dataSources: [],
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
          dataSources: [],
        });
        break;

      case "box-plot":
        form.setValue("config", {
          chartType: "box-plot",
          config: {
            yAxes: [
              {
                type: "linear",
                dataSource: { tableName: selectedTableName, columnName: "", alias: "" },
                side: "left",
                title: "",
                color: "#3b82f6",
              },
            ],
            categoryAxis: {
              type: "category",
              dataSource: { tableName: selectedTableName, columnName: "" },
              title: "",
            },
            orientation: "v",
            boxMode: "group",
            boxPoints: "outliers",
            notched: false,
            boxMean: "false",
            jitter: 0.3,
            pointPos: 0,
            notchWidth: 0.25,
            markerSize: 6,
            lineWidth: 2,
            fillOpacity: 0.7,
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
          dataSources: [],
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
          dataSources: [],
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
            colorscale: "viridis",
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
          dataSources: [],
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
            colorscale: "viridis",
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
          dataSources: [],
        });
        break;

      case "lollipop":
        form.setValue("config", {
          chartType: "lollipop",
          config: {
            xAxis: {
              type: "category", // Lollipop charts typically have categorical x-axis
              dataSource: { tableName: selectedTableName, columnName: "" },
              title: "",
            },
            yAxes: [
              {
                type: "linear", // Lollipop charts typically have linear y-axis
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
          dataSources: [],
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
          dataSources: [],
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
            colorscale: "viridis",
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
          dataSources: [],
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
              colorscale: "viridis",
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
          dataSources: [],
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
              },
            ],
            mode: "markers",
            markerSize: 8,
            markerShape: "circle",
            gridLines: "both",
            logBase: {
              x: 10,
              y: 10,
            },
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
          dataSources: [],
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
          dataSources: [],
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
          dataSources: [],
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
            <CardTitle>{t("details")}</CardTitle>
            <CardDescription>{t("detailsDescription")}</CardDescription>
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
          form={form}
          tables={sampleTables}
          selectedChartType={selectedChartType}
          onChartTypeSelect={handleChartTypeSelect}
        />

        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={onCancel}>
            {tCommon("common.cancel")}
          </Button>
          <Button type="submit" disabled={isPending || !selectedChartType}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {tCommon("common.creating")}
              </>
            ) : (
              tCommon("common.create")
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
