"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useWatch } from "react-hook-form";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";
import { WellKnownColumnTypes } from "@repo/api/schemas/experiment.schema";
import { filterColumnsForRole } from "@repo/api/utils/visualization-contracts";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Separator } from "@repo/ui/components/separator";

import { useExperimentVisualizationData } from "../../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import { firstDataSourceByRole } from "../form-values";
import type { ChartPanelProps } from "../types";
import { collectQuestionLabels } from "./aggregate";

const AGG_NEEDING_Y = new Set(["sum", "avg", "min", "max"]);

export function BarDataPanel({ form, columns }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");

  // X accepts categorical columns plus the well-known CONTRIBUTOR struct
  // and QUESTIONS array. `filterColumnsForRole` strips complex kinds
  // globally, so we union the well-known struct/array columns back in here
  // rather than relaxing the contract for every chart type.
  const xColumns = useMemo<DataColumn[]>(() => {
    const base = filterColumnsForRole(columns, "bar", "x");
    const wellKnownExtras = columns.filter(
      (c) =>
        (c.type_text === WellKnownColumnTypes.CONTRIBUTOR ||
          c.type_text === WellKnownColumnTypes.QUESTIONS) &&
        !base.some((b) => b.name === c.name),
    );
    return [...wellKnownExtras, ...base];
  }, [columns]);

  const yColumns = useMemo(() => filterColumnsForRole(columns, "bar", "y"), [columns]);

  const sources = useWatch({ control: form.control, name: "dataConfig.dataSources" });
  const xIndexed = firstDataSourceByRole(sources, "x");
  const yIndexed = firstDataSourceByRole(sources, "y");
  const xIndex = xIndexed?.index ?? 0;
  const yIndex = yIndexed?.index ?? 1;

  const aggregationFunction =
    useWatch({ control: form.control, name: "config.aggregationFunction" }) ?? "count";
  const yColumnName = yIndexed?.source.columnName ?? "";
  const xColumnType = useWatch({ control: form.control, name: "config.xColumnType" });
  const isQuestionsX = xColumnType === WellKnownColumnTypes.QUESTIONS;
  const xColumnName = xIndexed?.source.columnName ?? "";

  // When the X column is a QUESTIONS array, fetch a sample of rows so we
  // can populate the "Question" picker with the labels that actually exist
  // in the data. We only need the one column, and only when the picker is
  // visible — otherwise this hook stays disabled to avoid extra requests.
  // The route segment is `[id]`, hence `id` here is the experiment id.
  const routeParams = useParams<{ id: string }>();
  const resolvedExperimentId = routeParams.id;
  const tableName = useWatch({ control: form.control, name: "dataConfig.tableName" });
  const { data: questionSample } = useExperimentVisualizationData(
    resolvedExperimentId,
    { tableName, columns: xColumnName ? [xColumnName] : undefined },
    isQuestionsX && Boolean(tableName) && Boolean(xColumnName) && Boolean(resolvedExperimentId),
  );
  const questionLabels = useMemo(
    () => (isQuestionsX ? collectQuestionLabels(questionSample?.rows ?? [], xColumnName) : []),
    [isQuestionsX, questionSample, xColumnName],
  );

  const handleXChange = (columnName: string) => {
    const tableName = form.getValues("dataConfig.tableName");
    form.setValue(`dataConfig.dataSources.${xIndex}.tableName`, tableName);
    form.setValue("config.xAxisTitle", columnName);
    const picked = columns.find((c) => c.name === columnName);
    const nextType = picked?.type_text ?? "";
    form.setValue("config.xColumnType", nextType, { shouldDirty: true });
    // Switching X off of a QUESTIONS column makes the stored questionLabel
    // a phantom — clear it so the renderer doesn't keep looking up a key
    // that no longer applies.
    if (nextType !== WellKnownColumnTypes.QUESTIONS) {
      form.setValue("config.questionLabel", undefined, { shouldDirty: true });
    }
  };

  const handleYChange = (columnName: string) => {
    const tableName = form.getValues("dataConfig.tableName");
    form.setValue(`dataConfig.dataSources.${yIndex}.tableName`, tableName);
    form.setValue(`dataConfig.dataSources.${yIndex}.alias`, columnName, { shouldDirty: true });
    form.setValue("config.yAxisTitle", columnName);
    // Switching away from a Y column while keeping a numeric aggregation
    // would leave the renderer aggregating undefined; auto-fall-back to
    // count so the chart keeps rendering even mid-edit.
    if (!columnName && AGG_NEEDING_Y.has(aggregationFunction)) {
      form.setValue("config.aggregationFunction", "count", { shouldDirty: true });
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">{t("workspace.shelves.xAxis")}</h3>
        <FormField
          control={form.control}
          name={`dataConfig.dataSources.${xIndex}.columnName` as const}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">{t("workspace.shelves.column")}</FormLabel>
              <Select
                value={field.value || undefined}
                onValueChange={(value) => {
                  field.onChange(value);
                  handleXChange(value);
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("workspace.shelves.selectColumn")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {xColumns.map((column) => (
                    <SelectItem key={column.name} value={column.name}>
                      <div className="flex items-center gap-2">
                        <span>{column.name}</span>
                        <Badge
                          variant="outline"
                          className="text-muted-foreground h-4 px-1.5 py-0 font-mono text-[10px] font-normal leading-none"
                        >
                          {column.type_name}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {isQuestionsX && (
          <FormField
            control={form.control}
            name="config.questionLabel"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium">
                  {t("workspace.bar.question", "Question")}
                </FormLabel>
                <Select
                  value={typeof field.value === "string" && field.value ? field.value : undefined}
                  onValueChange={(value) => field.onChange(value)}
                  disabled={questionLabels.length === 0}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          questionLabels.length === 0
                            ? t("workspace.bar.questionLoading", "Loading questions…")
                            : t("workspace.bar.questionPlaceholder", "Select a question")
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {questionLabels.map((label) => (
                      <SelectItem key={label} value={label}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </section>

      <Separator />

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">{t("workspace.shelves.yAxis")}</h3>
        <p className="text-muted-foreground text-xs">
          {t("workspace.shelves.barYAxisHelp", "Optional. Leave empty for count.")}
        </p>
        <FormField
          control={form.control}
          name={`dataConfig.dataSources.${yIndex}.columnName` as const}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">{t("workspace.shelves.column")}</FormLabel>
              <Select
                value={field.value || undefined}
                onValueChange={(value) => {
                  field.onChange(value);
                  handleYChange(value);
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("workspace.shelves.selectColumn")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {yColumns.map((column) => (
                    <SelectItem key={column.name} value={column.name}>
                      <div className="flex items-center gap-2">
                        <span>{column.name}</span>
                        <Badge
                          variant="outline"
                          className="text-muted-foreground h-4 px-1.5 py-0 font-mono text-[10px] font-normal leading-none"
                        >
                          {column.type_name}
                        </Badge>
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
          name="config.aggregationFunction"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">
                {t("workspace.bar.aggregation")}
              </FormLabel>
              <Select
                value={String(field.value ?? "count")}
                onValueChange={(value) => field.onChange(value)}
                disabled={!yColumnName && AGG_NEEDING_Y.has(String(field.value))}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="count">
                    {t("workspace.bar.aggregations.count", "Count")}
                  </SelectItem>
                  <SelectItem value="sum" disabled={!yColumnName}>
                    {t("workspace.bar.aggregations.sum", "Sum")}
                  </SelectItem>
                  <SelectItem value="avg" disabled={!yColumnName}>
                    {t("workspace.bar.aggregations.avg", "Average")}
                  </SelectItem>
                  <SelectItem value="min" disabled={!yColumnName}>
                    {t("workspace.bar.aggregations.min", "Min")}
                  </SelectItem>
                  <SelectItem value="max" disabled={!yColumnName}>
                    {t("workspace.bar.aggregations.max", "Max")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </section>
    </div>
  );
}
