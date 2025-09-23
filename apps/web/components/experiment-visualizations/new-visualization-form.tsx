"use client";

// Import the SampleTable type from the API
import type { SampleTable } from "@/hooks/experiment/useExperimentData/useExperimentData";
import { useExperimentVisualizationCreate } from "@/hooks/experiment/useExperimentVisualizationCreate/useExperimentVisualizationCreate";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useForm } from "react-hook-form";

import type { ChartFamily, ChartType } from "@repo/api";
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
import type { ChartFormValues } from "./chart-configurators/types";

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
  const form = useForm({
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
          },
          yAxes: [
            {
              dataSource: { tableName: "", columnName: "" },
              type: "linear" as const,
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
            },
            yAxes: [
              {
                type: "linear",
                dataSource: { tableName: selectedTableName, columnName: "" },
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

      case "bar":
        form.setValue("config", {
          chartType: "bar",
          config: {
            xAxis: {
              type: "category",
              dataSource: { tableName: selectedTableName, columnName: "" },
            },
            yAxes: [
              {
                type: "linear",
                dataSource: { tableName: selectedTableName, columnName: "" },
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

      default:
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
          form={form as unknown as UseFormReturn<ChartFormValues>}
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
                {tCommon("creating")}
              </>
            ) : (
              tCommon("create")
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
