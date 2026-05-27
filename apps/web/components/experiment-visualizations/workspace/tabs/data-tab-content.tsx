"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { DataColumn, ExperimentTableMetadata } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Separator } from "@repo/ui/components/separator";

import type { ChartFormValues } from "../../charts/chart-config";
import { getChartTypeDef } from "../../charts/chart-registry";

export interface DataTabContentProps {
  form: UseFormReturn<ChartFormValues>;
  tables: ExperimentTableMetadata[];
  isTablesLoading?: boolean;
  tablesError?: unknown;
  selectedTableName: string;
  onTableChange: (tableName: string) => void;
  columns: DataColumn[];
  isColumnsLoading: boolean;
  columnsError?: unknown;
}

export function DataTabContent({
  form,
  tables,
  isTablesLoading = false,
  tablesError,
  selectedTableName,
  onTableChange,
  columns,
  isColumnsLoading,
  columnsError,
}: DataTabContentProps) {
  const { t } = useTranslation("experimentVisualizations");
  const chartType = useWatch({ control: form.control, name: "chartType" });
  const def = getChartTypeDef(chartType);

  if (isTablesLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 rounded-md border border-dashed p-4 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("workspace.inspector.loadingTables")}
      </div>
    );
  }

  return (
    <>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">{t("workspace.inspector.dataset")}</h3>

        <FormField
          control={form.control}
          name="dataConfig.tableName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">{t("workspace.inspector.dataset")}</FormLabel>
              <Select
                value={selectedTableName || undefined}
                onValueChange={(value) => {
                  field.onChange(value);
                  onTableChange(value);
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("workspace.inspector.selectTable")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {tablesError ? (
                    <div className="text-destructive px-2 py-1.5 text-sm">
                      {t("workspace.inspector.failedToLoadTables")}
                    </div>
                  ) : tables.length === 0 ? (
                    <div className="text-muted-foreground px-2 py-1.5 text-sm">
                      {t("workspace.inspector.noTables")}
                    </div>
                  ) : (
                    tables.map((table) => (
                      <SelectItem key={table.identifier} value={table.identifier}>
                        {table.displayName}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </section>

      <Separator />

      <ColumnsState
        hasTable={Boolean(selectedTableName)}
        isLoading={isColumnsLoading}
        error={columnsError}
        hasColumns={columns.length > 0}
      >
        {def ? <def.DataPanel form={form} columns={columns} /> : <UnsupportedPanel />}
      </ColumnsState>
    </>
  );
}

interface ColumnsStateProps {
  hasTable: boolean;
  isLoading: boolean;
  error: unknown;
  hasColumns: boolean;
  children: React.ReactNode;
}

function ColumnsState({ hasTable, isLoading, error, hasColumns, children }: ColumnsStateProps) {
  const { t } = useTranslation("experimentVisualizations");

  if (!hasTable) {
    return (
      <div className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
        {t("workspace.inspector.selectTableFirst")}
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 rounded-md border border-dashed p-4 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("workspace.inspector.loadingColumns")}
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-muted-foreground bg-muted/30 flex items-center gap-2 rounded-md border border-dashed p-4 text-sm">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {t("workspace.inspector.failedToLoadColumns")}
      </div>
    );
  }
  if (!hasColumns) {
    return (
      <div className="text-muted-foreground bg-muted/30 flex items-center gap-2 rounded-md border border-dashed p-4 text-sm">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {t("workspace.inspector.noValidColumns")}
      </div>
    );
  }
  return <>{children}</>;
}

function UnsupportedPanel() {
  const { t } = useTranslation("experimentVisualizations");
  return (
    <div className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
      {t("errors.chartTypeNotSupported")}
    </div>
  );
}
