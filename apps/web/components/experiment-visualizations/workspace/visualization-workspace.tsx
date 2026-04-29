"use client";

import { isValidAxisSource } from "@repo/api/utils/column-type-utils";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";

import type { ChartType } from "@repo/api/schemas/experiment.schema";
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
import { Button } from "@repo/ui/components/button";

import { useExperimentData } from "../../../hooks/experiment/useExperimentData/useExperimentData";
import { useExperimentTables } from "../../../hooks/experiment/useExperimentTables/useExperimentTables";
import type { ChartFormValues } from "../charts/form-values";
import { getChartTypeDef } from "../charts/registry";
import { ChartTypePicker } from "./chart-type-picker";
import { WorkspaceCanvas } from "./workspace-canvas";
import { WorkspaceInspector } from "./workspace-inspector";

interface VisualizationWorkspaceProps {
  experimentId: string;
  visualizationId: string;
}

export function VisualizationWorkspace({
  experimentId,
  visualizationId,
}: VisualizationWorkspaceProps) {
  const { t } = useTranslation("experimentVisualizations");
  const form = useFormContext<ChartFormValues>();

  const [pendingChartType, setPendingChartType] = useState<ChartType | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

  const {
    tables,
    isLoading: isLoadingTables,
    error: tablesError,
  } = useExperimentTables(experimentId);

  const tableName = form.watch("dataConfig.tableName") ?? "";

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
    () => (tableMetadata?.rawColumns ?? []).filter((col) => isValidAxisSource(col.type_text)),
    [tableMetadata],
  );

  const handleTableChange = (newTable: string) => {
    const currentDataSources = form.getValues("dataConfig.dataSources");
    const reset = currentDataSources.map((ds) => ({
      ...ds,
      tableName: newTable,
      columnName: "",
      alias: "",
    }));
    form.setValue("dataConfig.dataSources", reset, { shouldDirty: true });
    form.setValue("config.xAxisTitle", "", { shouldDirty: true });
    form.setValue("config.yAxisTitle", "", { shouldDirty: true });
  };

  const applyChartType = (type: ChartType) => {
    const def = getChartTypeDef(type);
    if (!def) return;
    const current = form.getValues();
    form.reset(
      {
        ...current,
        chartType: type,
        chartFamily: def.family,
        config: def.defaultConfig(),
        dataConfig: def.defaultDataConfig(current.dataConfig?.tableName),
      },
      { keepDefaultValues: true, keepDirty: true },
    );
    form.setValue("chartType", type, { shouldDirty: true });
  };

  const hasMeaningfulConfig = () => {
    const sources = form.getValues("dataConfig.dataSources") ?? [];
    return sources.some((ds) => Boolean(ds.columnName));
  };

  const handleChartTypeChange = (type: ChartType) => {
    if (type === form.getValues("chartType")) return;
    if (hasMeaningfulConfig()) {
      setPendingChartType(type);
    } else {
      applyChartType(type);
    }
  };

  const handleConfirmChartTypeChange = () => {
    if (pendingChartType) {
      applyChartType(pendingChartType);
    }
    setPendingChartType(null);
  };

  const isLoadingShell = isLoadingTables;

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between gap-2">
        <ChartTypePicker value={form.watch("chartType")} onChange={handleChartTypeChange} />

        <Button
          type="button"
          variant="outline"
          size={isInspectorOpen ? "icon" : "sm"}
          onClick={() => setIsInspectorOpen((prev) => !prev)}
          aria-label={t(
            isInspectorOpen ? "workspace.inspector.collapse" : "workspace.inspector.expand",
          )}
          aria-expanded={isInspectorOpen}
          className="bg-card text-muted-foreground hover:text-foreground gap-2"
        >
          {isInspectorOpen ? (
            <PanelRightClose className="size-4" />
          ) : (
            <>
              <PanelRightOpen className="size-4" />
              <span>{t("workspace.inspector.expandLabel")}</span>
            </>
          )}
        </Button>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <WorkspaceCanvas
            form={form}
            experimentId={experimentId}
            visualizationId={visualizationId}
          />
        </div>

        {isInspectorOpen && (
          <div className="w-full md:w-[420px] md:shrink-0">
            <WorkspaceInspector
              form={form}
              tables={tables ?? []}
              tablesError={tablesError}
              selectedTableName={tableName}
              onTableChange={handleTableChange}
              columns={columns}
              isColumnsLoading={isColumnsLoading || isLoadingShell}
              columnsError={columnsError}
            />
          </div>
        )}
      </div>

      <AlertDialog
        open={pendingChartType !== null}
        onOpenChange={(open) => {
          if (!open) setPendingChartType(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("workspace.charts.switchConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("workspace.charts.switchConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("ui.actions.back", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmChartTypeChange}>
              {t("workspace.charts.switchConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
