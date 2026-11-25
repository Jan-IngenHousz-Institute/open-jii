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
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const [copies, setCopies] = useState(new Map<string, string>());
  const widgets = useWatch({ control: form.control, name: "widgets" });
  const selectedWidget = widgets.find((widget) => widget.id === selectedWidgetId);
  const sourceChartId =
    selectedWidget?.type === "visualization" ? selectedWidget.config.visualizationId : undefined;
  const { duplicate, disabled } = useExperimentVisualizationDuplicate(experimentId, sourceChartId);
  const pending = [...copies].filter(([id]) => widgets.some((widget) => widget.id === id));
  const hasPendingCopy = pending.some(
    ([copyId, sourceId]) => selectedWidgetId === copyId || selectedWidgetId === sourceId,
  );
  if (pending.length < copies.size) setCopies(new Map(pending));
  const onSaved = useCallback(({ widgets: savedWidgets }: DashboardFormValues) => {
    setCopies((previous) => {
      const remaining = new Map(previous);
      for (const widget of savedWidgets) remaining.delete(widget.id);
      return remaining.size === previous.size ? previous : remaining;
    });
  }, []);
  const { hasError, error, flush } = useDashboardAutosave({
    form,
    experimentId,
    dashboardId,
    enabled,
    onSaved,
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
      source?.type !== "visualization" ||
      source.config.visualizationId !== sourceChartId
    ) {
      const openCopy = t("editor.inspector.openChartCopy");
      toast({
        title: t("editor.inspector.copyNotAttached"),
        action: (
          <ToastAction asChild altText={openCopy}>
            <Link
              href={`/${locale}/platform/experiments/${experimentId}/analysis/visualizations/${created.id}`}
            >
              {openCopy}
            </Link>
          </ToastAction>
        ),
      });
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
    setCopies((previous) => new Map(previous).set(copy.id, source.id));
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
