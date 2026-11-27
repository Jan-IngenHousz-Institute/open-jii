"use client";

import { usePrincipalSession } from "@/components/auth/principal-context";
import { checkCurrentSession, waitForCurrentSession } from "@/hooks/auth/is-current-session";
import { canEditExperimentContent } from "@/hooks/experiment/useExperimentAccess/can-edit-experiment-content";
import {
  experimentAccessQuery,
  experimentAccessQueryKey,
  hasConfirmedExperimentReadDenial,
  isExperimentReadDenied,
} from "@/hooks/experiment/useExperimentAccess/experiment-access-query";
import { useExperimentVisualizationDuplicate } from "@/hooks/experiment/useExperimentVisualizationDuplicate/useExperimentVisualizationDuplicate";
import { useLocale } from "@/hooks/useLocale";
import { orpc } from "@/lib/orpc";
import { onlineManager, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useWatch } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";

import type { ExperimentAccess } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { ToastAction } from "@repo/ui/components/toast";
import { toast } from "@repo/ui/hooks/use-toast";

import type { DashboardFormValues } from "../dashboard-form-shell";
import { compactWidgets } from "./canvas/dashboard-grid-helpers";
import { DashboardCopySaveContext } from "./context/dashboard-copy-save-context";
import { useDashboardEditor } from "./context/dashboard-editor-context";
import { useDashboardAutosave } from "./hooks/use-dashboard-autosave";

interface CreatedChart {
  id: string;
  name: string;
}

function chartCopyHref(locale: string, experimentId: string, chartId: string, isArchived: boolean) {
  const basePath = isArchived ? "experiments-archive" : "experiments";
  return `/${locale}/platform/${basePath}/${experimentId}/analysis/visualizations/${chartId}`;
}

function copyToastActions(
  charts: CreatedChart[],
  hrefFor: (chart: CreatedChart) => string,
  t: ReturnType<typeof useTranslation>["t"],
) {
  return charts.map((chart) => (
    <ToastAction
      key={chart.id}
      asChild
      altText={t("editor.inspector.openChartCopyNamed", { name: chart.name })}
    >
      <Link href={hrefFor(chart)}>
        {charts.length > 1 ? chart.name : t("editor.inspector.openChartCopy")}
      </Link>
    </ToastAction>
  ));
}

interface PendingCopy {
  sourceWidgetId: string;
  chart: CreatedChart;
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
  const queryClient = useQueryClient();
  const { userId, sessionId } = usePrincipalSession();
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
  const checkingRecovery = useRef(false);
  const lastReadableStatus = useRef<ExperimentAccess["experiment"]["status"] | undefined>(
    undefined,
  );
  const readCopyAccess = useCallback(() => {
    const queryKey = experimentAccessQueryKey(userId, experimentId);
    if (
      hasConfirmedExperimentReadDenial(queryClient, queryKey) ||
      isExperimentReadDenied(queryClient.getQueryState(queryKey)?.error)
    ) {
      lastReadableStatus.current = undefined;
    } else {
      const access = queryClient.getQueryData(queryKey);
      if (access)
        lastReadableStatus.current = access.hasAccess ? access.experiment.status : undefined;
    }
    return lastReadableStatus.current;
  }, [experimentId, queryClient, userId]);
  const widgets = useWatch({ control: form.control, name: "widgets" });
  const selectedWidget = widgets.find((widget) => widget.id === selectedWidgetId);
  const sourceChartId =
    selectedWidget?.type === "visualization" ? selectedWidget.config.visualizationId : undefined;
  const { duplicate, disabled } = useExperimentVisualizationDuplicate(experimentId, sourceChartId);
  const pending = [...copies].filter(([id]) => widgets.some((widget) => widget.id === id));
  const selectedCopy = pending.find(
    ([copyId, { sourceWidgetId }]) =>
      selectedWidgetId === copyId || selectedWidgetId === sourceWidgetId,
  )?.[1];
  if (pending.length < copies.size) setCopies(new Map(pending));

  const showUnattachedCopies = useCallback(
    async (charts: CreatedChart[]) => {
      for (const chart of charts) unattachedCharts.current.set(chart.id, chart);
      if (checkingRecovery.current) return;
      checkingRecovery.current = true;
      try {
        if (!(await waitForCurrentSession(queryClient, userId, sessionId))) {
          unattachedCharts.current.clear();
          return;
        }
        readCopyAccess();
        if (onlineManager.isOnline()) {
          const query = experimentAccessQuery(orpc, userId, experimentId);
          await queryClient
            .fetchQuery({ ...query, staleTime: 0, retry: false })
            .catch(() => undefined);
          readCopyAccess();
        }
        if (!(await waitForCurrentSession(queryClient, userId, sessionId))) {
          unattachedCharts.current.clear();
          return;
        }
        const status = readCopyAccess();
        const title = t("editor.inspector.copyNotAttached");
        if (status === undefined) {
          toast({ title });
          return;
        }
        const links = copyToastActions(
          [...unattachedCharts.current.values()],
          ({ id }) => chartCopyHref(locale, experimentId, id, status === "archived"),
          t,
        );
        toast({
          title,
          ...(links.length > 1
            ? { description: <div className="mt-1 flex flex-wrap gap-1">{links}</div> }
            : { action: links[0] }),
        });
      } finally {
        checkingRecovery.current = false;
      }
    },
    [experimentId, locale, queryClient, readCopyAccess, sessionId, t, userId],
  );

  const onSaved = useCallback(
    ({ widgets: savedWidgets }: DashboardFormValues) => {
      const remaining = new Map(copiesRef.current);
      for (const widget of savedWidgets) remaining.delete(widget.id);
      if (remaining.size !== copiesRef.current.size) updateCopies(remaining);
    },
    [updateCopies],
  );
  const getPendingCharts = useCallback(
    () =>
      form.getValues("widgets").flatMap(({ id }) => {
        const copy = copiesRef.current.get(id);
        return copy ? [copy.chart] : [];
      }),
    [form],
  );
  const onUnmountFlushed = useCallback(() => {
    if (mounted.current) return;
    const charts = getPendingCharts();
    if (charts.length > 0) void showUnattachedCopies(charts);
  }, [getPendingCharts, showUnattachedCopies]);
  const getCopyLinks = (linkLocale: string) => {
    const status = readCopyAccess();
    if (status === undefined) return [];
    return getPendingCharts().map((chart) => ({
      ...chart,
      href: chartCopyHref(linkLocale, experimentId, chart.id, status === "archived"),
    }));
  };
  const hasEditAccess = useCallback(() => {
    // The access cache updates before the form shell receives its new enabled prop.
    const query = experimentAccessQuery(orpc, userId, experimentId);
    const access = queryClient.getQueryData(query.queryKey);
    return access === undefined || canEditExperimentContent(access);
  }, [experimentId, queryClient, userId]);
  const { hasError, error, flush, inFlightWidgetIds } = useDashboardAutosave({
    form,
    experimentId,
    dashboardId,
    enabled,
    hasEditAccess,
    onSaved,
    onUnmountFlushed,
    getCopyLinks,
  });
  const retry = useCallback(() => {
    if (mounted.current) void flush({ retryFailed: true });
  }, [flush]);
  const showFailure = enabled && hasError && pending.length > 0 && hasEditAccess();
  const accessQuery = experimentAccessQuery(orpc, userId, experimentId);
  const { data: copyAccess, error: copyAccessError } = useQuery({ ...accessQuery, enabled: false });
  const copyLinkStatus =
    copyAccess?.hasAccess &&
    !isExperimentReadDenied(copyAccessError) &&
    !hasConfirmedExperimentReadDenial(queryClient, accessQuery.queryKey)
      ? copyAccess.experiment.status
      : undefined;
  const retryAvailable = showFailure && !!selectedCopy;
  const openCopyHref =
    retryAvailable && copyLinkStatus !== undefined
      ? chartCopyHref(locale, experimentId, selectedCopy.chart.id, copyLinkStatus === "archived")
      : undefined;
  const retryLabel = t("editor.inspector.retryCopySave");
  const failureTitle = t("editor.inspector.copySaveFailed");
  useEffect(() => {
    if (!showFailure) return;
    let active = true;
    let dismiss: (() => void) | undefined;
    void checkCurrentSession(sessionId).then((status) => {
      if (!active || status === "changed") return;
      const links =
        copyLinkStatus === undefined
          ? []
          : copyToastActions(
              Array.from(copies.values(), ({ chart }) => chart),
              ({ id }) => chartCopyHref(locale, experimentId, id, copyLinkStatus === "archived"),
              t,
            );
      dismiss = toast({
        title: failureTitle,
        variant: "destructive",
        description:
          links.length > 0 ? <div className="mt-1 flex flex-wrap gap-1">{links}</div> : undefined,
        action: (
          <ToastAction altText={retryLabel} onClick={retry}>
            {retryLabel}
          </ToastAction>
        ),
      }).dismiss;
    });
    return () => {
      active = false;
      dismiss?.();
    };
  }, [
    showFailure,
    error,
    retry,
    retryLabel,
    failureTitle,
    sessionId,
    copyLinkStatus,
    copies,
    locale,
    experimentId,
    t,
  ]);

  useEffect(() => {
    if (enabled || copies.size === 0) return;
    const current = form.getValues("widgets");
    const removedCopies = new Map<string, CreatedChart>();
    for (const widget of current) {
      const copy = copies.get(widget.id);
      if (copy && !inFlightWidgetIds?.has(widget.id)) {
        removedCopies.set(widget.id, copy.chart);
      }
    }
    if (removedCopies.size === 0) return;

    if (selectedWidgetId && removedCopies.has(selectedWidgetId)) selectWidget(null);
    const remaining = current.filter((widget) => !removedCopies.has(widget.id));
    form.setValue("widgets", compactWidgets(remaining, form.getValues("layout.columns")), {
      shouldDirty: true,
    });
    void showUnattachedCopies([...removedCopies.values()]);
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
    if (!enabled || selectedWidget?.type !== "visualization" || !sourceChartId || selectedCopy)
      return;
    readCopyAccess();
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
      await showUnattachedCopies([created]);
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
        duplicateDisabled: disabled || !!selectedCopy || !sourceChartId,
        duplicateSelectedChart,
        retryAvailable,
        openCopyHref,
        retry,
      }}
    >
      {children}
    </DashboardCopySaveContext.Provider>
  );
}
