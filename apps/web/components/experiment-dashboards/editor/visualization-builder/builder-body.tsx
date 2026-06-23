"use client";

import { useExperimentData } from "@/hooks/experiment/useExperimentData/useExperimentData";
import { useExperimentTables } from "@/hooks/experiment/useExperimentTables/useExperimentTables";
import { Database, Palette, Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { ExperimentChartType } from "@repo/api/domains/experiment/experiment.schema";
import { isPlottableColumn } from "@repo/api/transforms/column-type-utils";
import { useTranslation } from "@repo/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";

import type { ChartFormValues } from "../../../experiment-visualizations/charts/chart-config";
import { getChartTypeDef } from "../../../experiment-visualizations/charts/chart-registry";
import { ChartTypePicker } from "../../../experiment-visualizations/workspace/chart-type-picker";
import {
  DataTabContent,
  StyleTabContent,
  inspectorTabTriggerClass,
} from "../../../experiment-visualizations/workspace/workspace-inspector";

export interface BuilderBodyProps {
  experimentId: string;
  renderWidgetTab: (chartTypePicker: ReactNode) => ReactNode;
}

type BuilderTab = "widget" | "data" | "style";

export function BuilderBody({ experimentId, renderWidgetTab }: BuilderBodyProps) {
  const { t } = useTranslation("experimentVisualizations");
  const { t: tDash } = useTranslation("experimentDashboards");
  const { t: tCommon } = useTranslation("common");
  const form = useFormContext<ChartFormValues>();
  const [pendingChartType, setPendingChartType] = useState<ExperimentChartType | null>(null);
  const [activeTab, setActiveTab] = useState<BuilderTab>("widget");

  const {
    tables,
    isLoading: isLoadingTables,
    error: tablesError,
  } = useExperimentTables(experimentId);

  const tableName = useWatch({ control: form.control, name: "dataConfig.tableName" });
  const watchedChartType = useWatch({ control: form.control, name: "chartType" });

  const {
    tableMetadata,
    isLoading: isColumnsLoading,
    error: columnsError,
  } = useExperimentData({
    experimentId,
    page: 1,
    pageSize: 1,
    tableName,
    enabled: Boolean(tableName),
  });

  const columns = useMemo(
    () => (tableMetadata?.rawColumns ?? []).filter((col) => isPlottableColumn(col.type_text)),
    [tableMetadata],
  );

  const handleTableChange = (newTable: string) => {
    // Reset table-scoped fields so the next fetch doesn't 400 on stale columns.
    const currentDataSources = form.getValues("dataConfig.dataSources");
    const reset = currentDataSources.map((ds) => ({
      ...ds,
      tableName: newTable,
      columnName: "",
      alias: "",
      aggregate: undefined,
    }));
    form.setValue("dataConfig.dataSources", reset, { shouldDirty: true });
    form.setValue("dataConfig.aggregation", undefined, { shouldDirty: true });
    form.setValue("dataConfig.filters", undefined, { shouldDirty: true });
    form.setValue("config.xAxisTitle", "", { shouldDirty: true });
    form.setValue("config.yAxisTitle", "", { shouldDirty: true });
  };

  const applyChartType = (type: ExperimentChartType) => {
    const def = getChartTypeDef(type);
    const currentTable = form.getValues("dataConfig.tableName");
    form.setValue("chartFamily", def.family, { shouldDirty: true });
    form.setValue("config", def.defaultConfig(), { shouldDirty: true });
    form.setValue("dataConfig", def.defaultDataConfig(currentTable), { shouldDirty: true });
    form.setValue("chartType", type, { shouldDirty: true });
  };

  const hasMeaningfulConfig = () => {
    const sources = form.getValues("dataConfig.dataSources");
    return sources.some((ds) => Boolean(ds.columnName));
  };

  const handleChartTypeChange = (type: ExperimentChartType) => {
    if (type === form.getValues("chartType")) return;
    if (hasMeaningfulConfig()) {
      setPendingChartType(type);
    } else {
      applyChartType(type);
    }
  };

  const handleAlertOpenChange = (open: boolean) => {
    if (!open) setPendingChartType(null);
  };

  const handleConfirmSwitch = () => {
    if (pendingChartType) applyChartType(pendingChartType);
    setPendingChartType(null);
  };

  const handleCancelSwitch = () => setPendingChartType(null);

  const handleTabChange = (v: string) => {
    if (v === "widget" || v === "data" || v === "style") {
      setActiveTab(v);
    }
  };

  const chartTypePicker = (
    <ChartTypePicker value={watchedChartType} onChange={handleChartTypeChange} />
  );

  return (
    <div className="flex flex-col">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="bg-background sticky top-0 z-10 border-b px-4">
          <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-0 bg-transparent p-0">
            <TabsTrigger value="widget" className={inspectorTabTriggerClass}>
              <Settings2 className="size-4" />
              {tDash("editor.inspector.tabs.widget")}
            </TabsTrigger>
            <TabsTrigger value="data" className={inspectorTabTriggerClass}>
              <Database className="size-4" />
              {t("workspace.inspector.tabs.data")}
            </TabsTrigger>
            <TabsTrigger value="style" className={inspectorTabTriggerClass}>
              <Palette className="size-4" />
              {t("workspace.inspector.tabs.style")}
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="scrollbar-thin overscroll-contain p-4">
          <TabsContent value="widget" className="mt-0">
            {renderWidgetTab(chartTypePicker)}
          </TabsContent>
          <TabsContent value="data" className="mt-0 space-y-6">
            <DataTabContent
              form={form}
              experimentId={experimentId}
              tables={tables ?? []}
              isTablesLoading={isLoadingTables}
              tablesError={tablesError}
              selectedTableName={tableName}
              onTableChange={handleTableChange}
              columns={columns}
              isColumnsLoading={isColumnsLoading || isLoadingTables}
              columnsError={columnsError}
            />
          </TabsContent>
          <TabsContent value="style" className="mt-0">
            <StyleTabContent form={form} columns={columns} />
          </TabsContent>
        </div>
      </Tabs>

      <AlertDialog open={pendingChartType !== null} onOpenChange={handleAlertOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("workspace.charts.switchConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("workspace.charts.switchConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelSwitch}>
              {tCommon("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSwitch}>
              {t("workspace.charts.switchConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
