"use client";

import { useColumnMetadata } from "@/hooks/experiment/useColumnMetadata/useColumnMetadata";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { ExperimentTableMetadata } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { getColumnKind } from "@repo/api/transforms/column-type-utils";
import { isJoinMatchColumn } from "@repo/api/transforms/joined-columns";
import { useTranslation } from "@repo/i18n";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import type { ChartFormValues } from "../../charts/chart-config";

interface Props {
  form: UseFormReturn<ChartFormValues>;
  experimentId: string;
  tables: ExperimentTableMetadata[];
  tableName: string;
}

export function SecondTableSection({ form, experimentId, tables, tableName }: Props) {
  const { t } = useTranslation("experimentVisualizations");
  const join = useWatch({ control: form.control, name: "dataConfig.join" });
  const primary = useColumnMetadata(experimentId, tableName);
  const secondary = useColumnMetadata(experimentId, join?.tableName);
  const merged = useColumnMetadata(experimentId, tableName, join);
  const temporal = (columns: typeof primary.columns) =>
    columns.filter((c) => getColumnKind(c.type_text) === "temporal");
  const shared = primary.columns.filter(
    (c) =>
      isJoinMatchColumn(c) &&
      secondary.columns.some(
        (s) => s.name === c.name && s.type_text.toUpperCase() === c.type_text.toUpperCase(),
      ),
  );

  const changeTable = (value: string) => {
    const oldColumns = new Set(merged.columns.filter((c) => c.sourceTable).map((c) => c.name));
    form.setValue(
      "dataConfig.dataSources",
      form.getValues("dataConfig.dataSources").map((source) => ({
        ...source,
        columnName: oldColumns.has(source.columnName) ? "" : source.columnName,
        errorColumn:
          source.errorColumn && oldColumns.has(source.errorColumn) ? undefined : source.errorColumn,
      })),
      { shouldDirty: true },
    );
    form.setValue("dataConfig.filters", undefined, { shouldDirty: true });
    form.setValue("dataConfig.aggregation", undefined, { shouldDirty: true });
    form.setValue(
      "dataConfig.join",
      value === "none"
        ? undefined
        : {
            tableName: value,
            matchColumn: "",
            primaryTimeColumn: "",
            secondaryTimeColumn: "",
            toleranceMinutes: 5,
          },
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const columnField = (
    name: "matchColumn" | "primaryTimeColumn" | "secondaryTimeColumn",
    columns: typeof primary.columns,
  ) => (
    <FormField
      control={form.control}
      name={`dataConfig.join.${name}`}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t(`workspace.secondTable.${name}`)}</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={t("workspace.secondTable.chooseColumn")} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {columns.map((c) => (
                <SelectItem key={c.name} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  if (!tableName) return null;
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{t("workspace.secondTable.title")}</h3>
      <FormItem>
        <FormLabel>{t("workspace.secondTable.table")}</FormLabel>
        <Select value={join?.tableName ?? "none"} onValueChange={changeTable}>
          <SelectTrigger aria-label={t("workspace.secondTable.table")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("workspace.secondTable.none")}</SelectItem>
            {tables
              .filter((table) => table.identifier !== tableName)
              .map((table) => (
                <SelectItem key={table.identifier} value={table.identifier}>
                  {table.displayName}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </FormItem>
      {join && (
        <>
          <p className="text-muted-foreground text-xs">{t("workspace.secondTable.help")}</p>
          {primary.error || secondary.error ? (
            <p role="alert" className="text-destructive text-sm">
              {t("workspace.inspector.failedToLoadColumns")}
            </p>
          ) : (
            <>
              {columnField("matchColumn", shared)}
              {columnField("primaryTimeColumn", temporal(primary.columns))}
              {columnField("secondaryTimeColumn", temporal(secondary.columns))}
            </>
          )}
          <FormField
            control={form.control}
            name="dataConfig.join.toleranceMinutes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("workspace.secondTable.tolerance")}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={field.value}
                    onChange={(event) =>
                      field.onChange(event.target.value === "" ? NaN : Number(event.target.value))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    </section>
  );
}
