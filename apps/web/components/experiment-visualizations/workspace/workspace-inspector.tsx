"use client";

import { AlertCircle, Database, Loader2, Palette } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { DataColumn, ExperimentTableMetadata } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Card } from "@repo/ui/components/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Separator } from "@repo/ui/components/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { cn } from "@repo/ui/lib/utils";

import type { ChartFormValues } from "../charts/form-values";
import { getChartTypeDef } from "../charts/registry";

const tabTriggerClass = cn(
  "text-muted-foreground hover:text-foreground -mb-px gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm font-medium shadow-none",
  "data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:border-primary data-[state=active]:shadow-none",
);

interface WorkspaceInspectorProps {
  form: UseFormReturn<ChartFormValues>;
  tables: ExperimentTableMetadata[];
  tablesError?: unknown;
  selectedTableName: string;
  onTableChange: (tableName: string) => void;
  columns: DataColumn[];
  isColumnsLoading: boolean;
  columnsError?: unknown;
}

export function WorkspaceInspector({
  form,
  tables,
  tablesError,
  selectedTableName,
  onTableChange,
  columns,
  isColumnsLoading,
  columnsError,
}: WorkspaceInspectorProps) {
  const { t } = useTranslation("experimentVisualizations");

  const chartType = useWatch({ control: form.control, name: "chartType" });
  const def = getChartTypeDef(chartType);
  // Persist the active tab across chart-type switches; the previous default
  // had Tabs uncontrolled, so any re-render that remounted the inspector
  // (notably switching chart type) sent the user back to "data".
  const [activeTab, setActiveTab] = useState<"data" | "style">("data");

  return (
    <Card className="overflow-hidden shadow-none md:sticky md:top-6 md:flex md:max-h-[calc(100vh-3rem)] md:flex-col">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "data" | "style")}
        className="w-full md:flex md:min-h-0 md:flex-1 md:flex-col"
      >
        <div className="border-b px-4 md:shrink-0">
          <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-0 bg-transparent p-0">
            <TabsTrigger value="data" className={tabTriggerClass}>
              <Database className="size-4" />
              {t("workspace.inspector.tabs.data")}
            </TabsTrigger>
            <TabsTrigger value="style" className={tabTriggerClass}>
              <Palette className="size-4" />
              {t("workspace.inspector.tabs.style")}
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="scrollbar-thin overscroll-contain p-4 md:min-h-0 md:flex-1 md:overflow-y-auto">
          <TabsContent value="data" className="mt-0 space-y-6">
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
              {def ? (
                <def.DataPanel form={form} columns={columns} />
              ) : (
                <UnsupportedPanel />
              )}
            </ColumnsState>
          </TabsContent>

          <TabsContent value="style" className="mt-0">
            {def ? <def.StylePanel form={form} columns={columns} /> : <UnsupportedPanel />}
          </TabsContent>
        </div>
      </Tabs>
    </Card>
  );
}

function ColumnsState({
  hasTable,
  isLoading,
  error,
  hasColumns,
  children,
}: {
  hasTable: boolean;
  isLoading: boolean;
  error: unknown;
  hasColumns: boolean;
  children: React.ReactNode;
}) {
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
