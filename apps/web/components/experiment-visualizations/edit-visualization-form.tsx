"use client";

import type { SampleTable } from "@/hooks/experiment/useExperimentData/useExperimentData";
import { useExperimentVisualizationUpdate } from "@/hooks/experiment/useExperimentVisualizationUpdate/useExperimentVisualizationUpdate";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useForm } from "react-hook-form";

import type { ExperimentVisualization } from "@repo/api";
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
import type { ChartFormValues } from "./chart-configurators/chart-configurator-util";

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
  const [selectedChartType, setSelectedChartType] = useState<"line" | "scatter" | null>(
    visualization.chartType as "line" | "scatter",
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

      // Ensure all data sources have required fields
      const validDataSources = allDataSources
        .filter((source) => source.columnName && source.columnName.trim() !== "")
        .map((source) => ({
          tableName: source.tableName,
          columnName: source.columnName,
          role: source.role, // Role is required so no default needed
          alias: source.alias ?? "",
        }));

      const updatedData = {
        ...data,
        dataConfig: {
          ...data.dataConfig,
          dataSources: validDataSources,
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

  // Handle chart type selection - for edit form, preserve existing config
  const handleChartTypeSelect = (chartType: "line" | "scatter") => {
    setSelectedChartType(chartType);
    form.setValue("chartType", chartType);
    // Don't reset config when editing - let the user's existing configuration persist
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
