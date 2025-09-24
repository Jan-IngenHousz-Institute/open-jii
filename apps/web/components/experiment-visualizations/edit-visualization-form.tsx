"use client";

// Import the SampleTable type from the API
import type { SampleTable } from "@/hooks/experiment/useExperimentData/useExperimentData";
import { useExperimentVisualizationUpdate } from "@/hooks/experiment/useExperimentVisualizationUpdate/useExperimentVisualizationUpdate";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import type {
  ChartType,
  ExperimentVisualization,
  UpdateExperimentVisualizationBody,
} from "@repo/api";
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

// Import components
import ChartConfigurator from "./chart-configurators/chart-configurator";

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
  const form = useForm<UpdateExperimentVisualizationBody>({
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

  // Handle form submission
  const onSubmit = form.handleSubmit((data) => {
    updateVisualization({
      params: {
        id: experimentId,
        visualizationId: visualization.id,
      },
      body: data,
    });
  });

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

      case "scatter":
        form.setValue("config", {
          chartType: "scatter",
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
            mode: "markers",
            markerSize: 6,
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

      case "bar":
        form.setValue("config", {
          chartType: "bar",
          config: {
            xAxis: {
              type: "category", // Bar charts typically have categorical x-axis
              dataSource: { tableName: selectedTableName, columnName: "" },
            },
            yAxes: [
              {
                type: "linear", // Bar charts typically have linear y-axis
                dataSource: { tableName: selectedTableName, columnName: "" },
                side: "left",
              },
            ],
            orientation: "vertical",
            barMode: "group",
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
            },
            yAxes: [
              {
                type: "linear", // Area charts typically use linear y-axis
                dataSource: { tableName: selectedTableName, columnName: "" },
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
            },
            yAxes: [
              {
                type: "linear", // Dot plots typically use linear y-axis for values
                dataSource: { tableName: selectedTableName, columnName: "" },
                side: "left",
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
          form={form}
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
