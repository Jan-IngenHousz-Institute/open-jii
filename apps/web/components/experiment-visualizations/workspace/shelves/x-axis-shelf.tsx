"use client";

import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { ExperimentDataColumn, ExperimentTimeBucketUnit } from "@repo/api/domains/experiment/experiment.schema";
import { getColumnKind } from "@repo/api/transforms/column-type-utils";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { defaultAxisTypeFor } from "../../charts/chart-config";
import type { ChartFormValues } from "../../charts/chart-config";
import {
  getColumnBucket,
  setColumnBucket,
  setDataSourceAggregate,
} from "../../charts/data/aggregation";
import { dataSourcesByRole, firstDataSourceByRole } from "../../charts/data/data-sources";

const BUCKET_NONE = "__none__";

const TIME_BUCKETS: { value: ExperimentTimeBucketUnit; label: string }[] = [
  { value: "minute", label: "Minute" },
  { value: "hour", label: "Hour" },
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

interface XAxisShelfProps {
  form: UseFormReturn<ChartFormValues>;
  columns: ExperimentDataColumn[];
  hideAxisType?: boolean;
  hideTimeBucket?: boolean;
  allowNone?: boolean;
}

const X_NONE_SENTINEL = "__none__";

export function XAxisShelf({
  form,
  columns,
  hideAxisType = false,
  hideTimeBucket = false,
  allowNone = false,
}: XAxisShelfProps) {
  const { t } = useTranslation("experimentVisualizations");

  const sources = useWatch({ control: form.control, name: "dataConfig.dataSources" });
  const aggregation = useWatch({ control: form.control, name: "dataConfig.aggregation" });
  const indexed = firstDataSourceByRole(sources, "x");
  const xIndex = indexed?.index ?? 0;
  const xColumnName = indexed?.source.columnName ?? "";
  const xColumn = columns.find((c) => c.name === xColumnName);
  const isTemporal = getColumnKind(xColumn?.type_text) === "temporal";
  const currentBucket = getColumnBucket(aggregation, xColumnName);
  const hasFunctions = (aggregation?.functions?.length ?? 0) > 0;

  const handleColumnChange = (value: string) => {
    const tableName = form.getValues("dataConfig.tableName");
    form.setValue(`dataConfig.dataSources.${xIndex}.tableName`, tableName);

    // The "None" sentinel maps to an empty `columnName`. The renderer
    // synthesises X from row index. Clear the axis-title and reset the
    // axis type to linear (row index is always 0..n-1).
    if (value === "") {
      form.setValue("config.xAxisTitle", "");
      form.setValue("config.xAxisType", "linear", { shouldDirty: true });
      if (xColumnName) {
        setColumnBucket(form, xColumnName, undefined, hasFunctions);
      }
      return;
    }

    form.setValue("config.xAxisTitle", value);
    // Auto-pick the axis scale for the picked column's data type. Strings
    // become category axes, timestamps/dates become date axes, numerics
    // stay linear. Users can still override via the "Axis type" select.
    const picked = columns.find((c) => c.name === value);
    form.setValue("config.xAxisType", defaultAxisTypeFor(picked?.type_text), {
      shouldDirty: true,
    });

    // Drop a stale time bucket if the new column isn't temporal; otherwise
    // a leftover Hour/Day setting would compile to date_trunc on a string
    // column and Databricks would reject it.
    const newKind = getColumnKind(picked?.type_text);
    if (xColumnName && newKind !== "temporal") {
      setColumnBucket(form, xColumnName, undefined, hasFunctions);
    }
  };

  const handleBucketChange = (raw: string) => {
    const bucket = raw === BUCKET_NONE ? undefined : (raw as ExperimentTimeBucketUnit);
    setColumnBucket(form, xColumnName, bucket, hasFunctions);

    // Bucketing X without aggregating Y produces SQL that projects only
    // the bucket. Default each Y series without an explicit aggregate to
    // AVG so picking a Bucket actually changes the chart.
    if (bucket !== undefined) {
      const ySources = dataSourcesByRole(sources, "y").filter(
        (d) => d.source.columnName && d.source.columnName.length > 0,
      );
      for (const { source, index } of ySources) {
        if (source.aggregate === undefined) {
          setDataSourceAggregate(form, index, "avg", xColumnName);
        }
      }
    }
  };

  // The time-bucket dropdown only renders for temporal columns, and chart
  // types can suppress it via `hideTimeBucket`.
  const showTimeBucket = isTemporal && !hideTimeBucket;

  // When axis-type is hidden and there's no time bucket, the column and
  // axis-title are the only two controls. Pair them side-by-side instead
  // of stacking.
  const inlineTitleWithColumn = hideAxisType && !showTimeBucket;

  const titleField = (
    <FormField
      control={form.control}
      name="config.xAxisTitle"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-medium">{t("workspace.shelves.axisTitle")}</FormLabel>
          <FormControl>
            <Input placeholder={t("workspace.shelves.axisTitlePlaceholder")} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{t("workspace.shelves.xAxis")}</h3>

      <div
        className={
          showTimeBucket
            ? "grid grid-cols-[1fr_auto] items-end gap-3"
            : inlineTitleWithColumn
              ? "grid grid-cols-2 gap-3"
              : ""
        }
      >
        <FormField
          control={form.control}
          name={`dataConfig.dataSources.${xIndex}.columnName` as const}
          render={({ field }) => {
            // Map the form's empty-string "no column" state onto the
            // explicit `__none__` sentinel so the Select can render the
            // "None" item as the active choice. Without this, an empty
            // value would fall through to the placeholder and users
            // wouldn't see that they had picked the no-column path.
            const isNone = allowNone && field.value === "";
            const selectValue = isNone ? X_NONE_SENTINEL : field.value;
            return (
              <FormItem className="min-w-0">
                <FormLabel className="text-xs font-medium">
                  {t("workspace.shelves.column")}
                </FormLabel>
                <Select
                  value={selectValue}
                  onValueChange={(value) => {
                    const next = value === X_NONE_SENTINEL ? "" : value;
                    field.onChange(next);
                    handleColumnChange(next);
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("workspace.shelves.selectColumn")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {allowNone && (
                      <SelectItem value={X_NONE_SENTINEL}>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground italic">
                            {t("workspace.shelves.xAxisNone")}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-muted-foreground h-4 px-1.5 py-0 font-mono text-[10px] font-normal leading-none"
                          >
                            INDEX
                          </Badge>
                        </div>
                      </SelectItem>
                    )}
                    {columns.map((column) => (
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
                {isNone && (
                  <p className="text-muted-foreground text-xs italic">
                    {t("workspace.shelves.xAxisNoneHelp")}
                  </p>
                )}
                <FormMessage />
              </FormItem>
            );
          }}
        />

        {/* Time bucket: only for temporal X. Drives `dataConfig.aggregation`
            directly. None == raw timestamps (no bucketing). */}
        {showTimeBucket && (
          <FormItem className="w-[130px]">
            <FormLabel className="text-xs font-medium">
              {t("workspace.shelves.timeBucket")}
            </FormLabel>
            <Select value={currentBucket ?? BUCKET_NONE} onValueChange={handleBucketChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder={t("workspace.shelves.noBucket")} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value={BUCKET_NONE}>{t("workspace.shelves.noBucket")}</SelectItem>
                {TIME_BUCKETS.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        )}

        {inlineTitleWithColumn && titleField}
      </div>

      {!inlineTitleWithColumn && (
        <div className={hideAxisType ? "" : "grid grid-cols-2 gap-3"}>
          {titleField}

          {!hideAxisType && (
            <FormField
              control={form.control}
              name="config.xAxisType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">
                    {t("workspace.shelves.axisType")}
                  </FormLabel>
                  <Select value={String(field.value ?? "linear")} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="linear">{t("workspace.axisTypes.linear")}</SelectItem>
                      <SelectItem value="log">{t("workspace.axisTypes.log")}</SelectItem>
                      <SelectItem value="date">{t("workspace.axisTypes.date")}</SelectItem>
                      <SelectItem value="category">{t("workspace.axisTypes.category")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
      )}
    </section>
  );
}
