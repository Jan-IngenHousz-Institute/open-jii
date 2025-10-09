"use client";

import type { SampleTable } from "@/hooks/experiment/useExperimentData/useExperimentData";
import { useExperimentVisualizationCreate } from "@/hooks/experiment/useExperimentVisualizationCreate/useExperimentVisualizationCreate";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useForm } from "react-hook-form";

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

import ChartConfigurator, {
  collectAllChartDataSources,
} from "./chart-configurators/chart-configurator";
import type { ChartFormValues } from "./chart-configurators/chart-configurator-util";
import { getDefaultChartConfig } from "./chart-configurators/chart-configurator-util";

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
  const [selectedChartType, setSelectedChartType] = useState<"line" | "scatter" | null>(null);

  // Form setup with properly typed default values for role-based approach
  const form = useForm({
    resolver: zodResolver(zCreateExperimentVisualizationBody),
    mode: "onChange", // Enable validation on change
    defaultValues: {
      name: "",
      description: "",
      chartFamily: "basic",
      chartType: "line",
      config: getDefaultChartConfig("line"),
      dataConfig: {
        tableName: "",
        dataSources: [],
      },
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

  // Use the imported collectAllChartDataSources function
  const collectAllDataSources = () => {
    return collectAllChartDataSources(form as UseFormReturn<ChartFormValues>);
  };

  // Handle form submission
  const onSubmit = form.handleSubmit(
    (data) => {
      // Explicitly collect all data sources before submission
      const allDataSources = collectAllDataSources();

      // Ensure all data sources have required fields
      const validDataSources = allDataSources
        .filter((source) => source.columnName && source.columnName.trim() !== "")
        .map((source) => ({
          tableName: source.tableName,
          columnName: source.columnName,
          role: source.role, // Role is required so no default needed
          alias: source.alias ?? "",
        }));

      const cleanedData = {
        ...data,
        dataConfig: {
          ...data.dataConfig,
          dataSources: validDataSources,
        },
      };

      createVisualization({
        params: { id: experimentId },
        body: cleanedData,
      });
    },
    (_errors) => {
      // Show a toast with validation error info
      toast({
        description:
          "Please fill in all required fields. You need to select columns for your chart axes.",
        title: "Validation Error",
        variant: "destructive",
      });
    },
  );

  // We no longer need the handleFamilyChange function since we're selecting chart types directly

  // Handle chart type selection
  const handleChartTypeSelect = (chartType: "line" | "scatter") => {
    setSelectedChartType(chartType);
    form.setValue("chartType", chartType);

    // Initialize config based on chart type and selected table
    const selectedTableName =
      form.getValues("dataConfig.tableName") ||
      (sampleTables.length > 0 ? sampleTables[0].name : "");

    // Role-based chart initialization - each chart type gets appropriate roles
    const getRolesForChartType = (
      type: "line" | "scatter",
    ): { role: string; required: boolean }[] => {
      switch (type) {
        case "line":
          return [
            { role: "x", required: true },
            { role: "y", required: true },
          ];
        case "scatter":
          return [
            { role: "x", required: true },
            { role: "y", required: true },
            { role: "color", required: false },
          ];
        default:
          return [
            { role: "x", required: true },
            { role: "y", required: true },
          ];
      }
    };

    // Use centralized default config function

    const roles = getRolesForChartType(chartType);
    // Only create data sources for required roles initially
    const dataSources = roles
      .filter(({ required }) => required)
      .map(({ role }) => ({
        tableName: selectedTableName,
        columnName: "",
        alias: "",
        role: role, // Explicitly set role as required string
      }));

    // Set chart-specific default config
    form.setValue("config", getDefaultChartConfig(chartType));
    form.setValue("dataConfig", {
      tableName: selectedTableName,
      dataSources,
    });
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
                    <Textarea placeholder={t("descriptionPlaceholder")} {...field} />
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
            {tCommon("common.cancel")}
          </Button>
          <Button type="submit" disabled={isPending}>
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
