"use client";

import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { ChartType } from "@repo/api/schemas/experiment.schema";
import { WellKnownColumnTypes } from "@repo/api/schemas/experiment.schema";
import { isPlottableColumn } from "@repo/api/utils/column-type-utils";
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

  // One plottable column list (complex types stripped). Each chart's
  // data-panel applies per-role kind filtering on top via
  // `filterColumnsForRole` from the visualization contracts.
  //
  // CONTRIBUTOR (STRUCT) and QUESTIONS (ARRAY<STRUCT>) would normally be
  // stripped here as kind="complex", but the bar chart accepts them on its
  // X axis to support per-contributor and per-question-answer histograms.
  // Keeping them in the list is safe for other chart types because
  // `filterColumnsForRole` re-drops complex kinds for any role whose
  // contract doesn't explicitly accept them.
  const columns = useMemo(
    () =>
      (tableMetadata?.rawColumns ?? []).filter(
        (col) =>
          isPlottableColumn(col.type_text) ||
          col.type_text === WellKnownColumnTypes.CONTRIBUTOR ||
          col.type_text === WellKnownColumnTypes.QUESTIONS,
      ),
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
    // Drive each field through `setValue` so the autosave watch sees a
    // `change` event for every modified slice; the trailing chartType update
    // ensures the debounce ends with a snapshot containing all four values.
    // The previous `reset` + trailing `setValue` combo only emitted a single
    // change event for `chartType`, leaving autosave's snapshot internally
    // consistent only by accident of RHF's synchronous read semantics.
    const tableName = form.getValues("dataConfig.tableName");
    form.setValue("chartFamily", def.family, { shouldDirty: true });
    form.setValue("config", def.defaultConfig(), { shouldDirty: true });
    form.setValue("dataConfig", def.defaultDataConfig(tableName), { shouldDirty: true });
    form.setValue("chartType", type, { shouldDirty: true });
  };

  const hasMeaningfulConfig = () => {
    const sources = form.getValues("dataConfig.dataSources");
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
        <ChartTypePicker value={watchedChartType} onChange={handleChartTypeChange} />

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

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <WorkspaceCanvas
            control={form.control}
            experimentId={experimentId}
            visualizationId={visualizationId}
          />
        </div>

        {isInspectorOpen && (
          <div className="w-full lg:w-[320px] lg:shrink-0 xl:w-[380px] 2xl:w-[440px]">
            <WorkspaceInspector
              form={form}
              tables={tables ?? []}
              isTablesLoading={isLoadingTables}
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
