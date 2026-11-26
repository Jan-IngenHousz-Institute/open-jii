"use client";

import { useExperimentVisualizationDuplicate } from "@/hooks/experiment/useExperimentVisualizationDuplicate/useExperimentVisualizationDuplicate";
import { useLocale } from "@/hooks/useLocale";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useWatch } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";

import { useTranslation } from "@repo/i18n";
import { ToastAction } from "@repo/ui/components/toast";
import { toast } from "@repo/ui/hooks/use-toast";

import type { DashboardFormValues } from "../../dashboard-form-shell";
import { compactWidgets } from "../canvas/dashboard-grid-helpers";
import { useDashboardAutosave } from "../hooks/use-dashboard-autosave";
import { useDashboardEditor } from "./dashboard-editor-context";

interface DashboardCopySave {
  enabled: boolean;
  duplicateDisabled: boolean;
  duplicateSelectedChart: () => Promise<void>;
  retryAvailable: boolean;
  retry: () => void;
}

interface CreatedChart {
  id: string;
  name: string;
}

interface PendingCopy {
  sourceWidgetId: string;
  chart: CreatedChart;
}

const DashboardCopySaveContext = createContext<DashboardCopySave | null>(null);

export function useDashboardCopySave() {
  return useContext(DashboardCopySaveContext);
}

interface DashboardAutosaveBoundaryProps {
  form: UseFormReturn<DashboardFormValues>;
  experimentId: string;
  dashboardId: string;
  enabled: boolean;
  children: ReactNode;
}

export function DashboardAutosaveBoundary({
  form,
  experimentId,
  dashboardId,
  enabled,
  children,
}: DashboardAutosaveBoundaryProps) {
  const { t } = useTranslation("experimentDashboards");
  const locale = useLocale();
  const { selectedWidgetId, selectWidget } = useDashboardEditor();
  const mounted = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const [copies, setCopies] = useState(new Map<string, PendingCopy>());
  const copiesRef = useRef(copies);
  copiesRef.current = copies;
  const updateCopies = useCallback((next: Map<string, PendingCopy>) => {
    copiesRef.current = next;
    if (mounted.current) setCopies(next);
  }, []);
  const unattachedCharts = useRef(new Map<string, CreatedChart>());
  const widgets = useWatch({ control: form.control, name: "widgets" });
  const selectedWidget = widgets.find((widget) => widget.id === selectedWidgetId);
  const sourceChartId =
    selectedWidget?.type === "visualization" ? selectedWidget.config.visualizationId : undefined;
  const { duplicate, disabled } = useExperimentVisualizationDuplicate(experimentId, sourceChartId);
  const pending = [...copies].filter(([id]) => widgets.some((widget) => widget.id === id));
  const hasPendingCopy = pending.some(
    ([copyId, { sourceWidgetId }]) =>
      selectedWidgetId === copyId || selectedWidgetId === sourceWidgetId,
  );
  if (pending.length < copies.size) setCopies(new Map(pending));

  const showUnattachedCopies = useCallback(
    (charts: CreatedChart[]) => {
      for (const chart of charts) unattachedCharts.current.set(chart.id, chart);
      const openCopy = t("editor.inspector.openChartCopy");
      const nameLinks = unattachedCharts.current.size > 1;
      const links = [...unattachedCharts.current.values()].map((chart) => (
        <ToastAction key={chart.id} asChild altText={`${openCopy} ${chart.name}`}>
          <Link
            href={`/${locale}/platform/experiments/${experimentId}/analysis/visualizations/${chart.id}`}
          >
            {nameLinks ? chart.name : openCopy}
          </Link>
        </ToastAction>
      ));
      toast({
        title: t("editor.inspector.copyNotAttached"),
        ...(nameLinks
          ? { description: <div className="mt-1 flex flex-wrap gap-1">{links}</div> }
          : { action: links[0] }),
      });
    },
    [experimentId, locale, t],
  );

  const onSaved = useCallback(
    ({ widgets: savedWidgets }: DashboardFormValues) => {
      const remaining = new Map(copiesRef.current);
      for (const widget of savedWidgets) remaining.delete(widget.id);
      if (remaining.size !== copiesRef.current.size) updateCopies(remaining);
    },
    [updateCopies],
  );
  const onSaveFailed = useCallback(
    (failedWidgetIds: ReadonlySet<string>, inFlightWidgetIds: readonly ReadonlySet<string>[]) => {
      if (mounted.current) return;
      const charts = form.getValues("widgets").flatMap(({ id }) => {
        const copy = copiesRef.current.get(id);
        return copy && failedWidgetIds.has(id) && !inFlightWidgetIds.some((ids) => ids.has(id))
          ? [copy.chart]
          : [];
      });
      if (charts.length > 0) showUnattachedCopies(charts);
    },
    [form, showUnattachedCopies],
  );
  const { hasError, error, flush, inFlightWidgetIds } = useDashboardAutosave({
    form,
    experimentId,
    dashboardId,
    enabled,
    onSaved,
    onSaveFailed,
  });
  const retry = useCallback(() => {
    if (mounted.current) void flush({ retryFailed: true });
  }, [flush]);
  const showFailure = enabled && hasError && pending.length > 0;
  const retryLabel = t("editor.inspector.retryCopySave");
  const failureTitle = t("editor.inspector.copySaveFailed");
  useEffect(() => {
    if (!showFailure) return;
    const notification = toast({
      title: failureTitle,
      variant: "destructive",
      action: (
        <ToastAction altText={retryLabel} onClick={retry}>
          {retryLabel}
        </ToastAction>
      ),
    });
    return notification.dismiss;
  }, [showFailure, error, retry, retryLabel, failureTitle]);

  useEffect(() => {
    if (enabled || copies.size === 0) return;
    const current = form.getValues("widgets");
    const removedCopies = new Map<string, CreatedChart>();
    for (const widget of current) {
      const copy = copies.get(widget.id);
      if (copy && !inFlightWidgetIds.some((ids) => ids.has(widget.id))) {
        removedCopies.set(widget.id, copy.chart);
      }
    }
    if (removedCopies.size === 0) return;

    if (selectedWidgetId && removedCopies.has(selectedWidgetId)) selectWidget(null);
    const remaining = current.filter((widget) => !removedCopies.has(widget.id));
    form.setValue("widgets", compactWidgets(remaining, form.getValues("layout.columns")), {
      shouldDirty: true,
    });
    showUnattachedCopies([...removedCopies.values()]);
  }, [
    enabled,
    copies,
    inFlightWidgetIds,
    form,
    selectedWidgetId,
    selectWidget,
    showUnattachedCopies,
  ]);

  const duplicateSelectedChart = async () => {
    if (!enabled || selectedWidget?.type !== "visualization" || !sourceChartId || hasPendingCopy)
      return;
    const sourceWidgetId = selectedWidget.id;
    const created = await duplicate();
    if (!created) return;
    const current = form.getValues("widgets");
    const source = current.find((candidate) => candidate.id === sourceWidgetId);
    if (
      !mounted.current ||
      !enabledRef.current ||
      source?.type !== "visualization" ||
      source.config.visualizationId !== sourceChartId
    ) {
      showUnattachedCopies([created]);
      return;
    }
    const copy = {
      ...source,
      id: crypto.randomUUID(),
      config: { ...source.config, visualizationId: created.id },
      layout: { ...source.layout, row: source.layout.row + source.layout.rowSpan },
    };
    const insertionRow = copy.layout.row;
    const shifted = current.map((candidate) =>
      candidate.layout.row >= insertionRow
        ? {
            ...candidate,
            layout: { ...candidate.layout, row: candidate.layout.row + copy.layout.rowSpan },
          }
        : candidate,
    );
    form.setValue("widgets", compactWidgets([...shifted, copy], form.getValues("layout.columns")), {
      shouldDirty: true,
    });
    updateCopies(
      new Map(copiesRef.current).set(copy.id, { sourceWidgetId: source.id, chart: created }),
    );
    selectWidget(copy.id);
  };

  return (
    <DashboardCopySaveContext.Provider
      value={{
        enabled,
        duplicateDisabled: disabled || hasPendingCopy || !sourceChartId,
        duplicateSelectedChart,
        retryAvailable: showFailure && hasPendingCopy,
        retry,
      }}
    >
      {children}
    </DashboardCopySaveContext.Provider>
  );
}
