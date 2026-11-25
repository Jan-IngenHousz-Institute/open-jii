"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useWatch } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";

import { useTranslation } from "@repo/i18n";
import { ToastAction } from "@repo/ui/components/toast";
import { toast } from "@repo/ui/hooks/use-toast";

import type { DashboardFormValues } from "../../dashboard-form-shell";
import { useDashboardAutosave } from "../hooks/use-dashboard-autosave";

interface DashboardCopySave {
  pending: ReadonlyMap<string, string>;
  track: (copyWidgetId: string, sourceWidgetId: string) => void;
  failed: boolean;
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
  const [copies, setCopies] = useState(new Map<string, string>());
  const widgets = useWatch({ control: form.control, name: "widgets" });
  const track = (copyWidgetId: string, sourceWidgetId: string) => {
    setCopies((previous) => new Map(previous).set(copyWidgetId, sourceWidgetId));
  };
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
  const pending = new Map([...copies].filter(([id]) => widgets.some((widget) => widget.id === id)));
  const retry = useCallback(() => void flush({ retryFailed: true }), [flush]);
  const showFailure = hasError && pending.size > 0;
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

  return (
    <DashboardCopySaveContext.Provider value={{ pending, track, failed: hasError, retry }}>
      {children}
    </DashboardCopySaveContext.Provider>
  );
}
