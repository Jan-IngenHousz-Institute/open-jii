"use client";

import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { canDuplicateExperimentChart } from "@/util/can-duplicate-experiment-chart";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { FormProvider, useForm } from "react-hook-form";

import type {
  ExperimentDashboardLayout,
  ExperimentDashboardWidget,
  ExperimentDashboard,
} from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import { Form } from "@repo/ui/components/form";

import { AutosaveStatusProvider } from "../shared/autosave/autosave-status-context";
import { DashboardLayoutContent } from "./dashboard-layout-content";
import { DashboardModeProvider } from "./dashboard-mode-context";
import { DashboardAutosaveBoundary } from "./editor/context/dashboard-copy-save-context";
import { DashboardEditorProvider } from "./editor/context/dashboard-editor-context";
import { getPendingDashboardCloseSave } from "./editor/hooks/use-dashboard-autosave";

export interface DashboardFormValues {
  name: string;
  description?: string;
  layout: ExperimentDashboardLayout;
  widgets: ExperimentDashboardWidget[];
}

export interface DashboardFormShellProps {
  experimentId: string;
  dashboardId: string;
  dashboard: ExperimentDashboard;
  initialMode: "view" | "edit";
  children: ReactNode;
}

export function DashboardFormShell(props: DashboardFormShellProps) {
  const [closeSave] = useState(() =>
    getPendingDashboardCloseSave(props.experimentId, props.dashboardId),
  );

  return closeSave ? (
    <DashboardFormAfterCloseSave {...props} closeSave={closeSave} />
  ) : (
    <DashboardForm {...props} />
  );
}

function DashboardFormAfterCloseSave({
  closeSave,
  ...props
}: DashboardFormShellProps & { closeSave: Promise<ExperimentDashboard> }) {
  const [result, setResult] = useState<{ dashboard?: ExperimentDashboard; error?: unknown }>();
  useEffect(() => {
    let active = true;
    void closeSave.then(
      (dashboard) => {
        if (active) setResult({ dashboard });
      },
      (error) => {
        if (active) setResult({ error });
      },
    );
    return () => {
      active = false;
    };
  }, [closeSave]);

  return (
    <EntityLayoutShell isLoading={!result} error={result?.error} hasData={!!result?.dashboard}>
      {result?.dashboard && <DashboardForm {...props} initialDashboard={result.dashboard} />}
    </EntityLayoutShell>
  );
}

function DashboardForm({
  experimentId,
  dashboardId,
  dashboard,
  initialDashboard = dashboard,
  initialMode,
  children,
}: DashboardFormShellProps & { initialDashboard?: ExperimentDashboard }) {
  const defaults = useMemo<DashboardFormValues>(
    () => ({
      name: initialDashboard.name,
      description: initialDashboard.description ?? "",
      layout: initialDashboard.layout,
      widgets: initialDashboard.widgets,
    }),
    [initialDashboard],
  );

  const form = useForm<DashboardFormValues>({ defaultValues: defaults });
  const { data: accessData } = useExperimentAccess(experimentId);
  const canEdit = canDuplicateExperimentChart(accessData);

  return (
    <AutosaveStatusProvider>
      <DashboardEditorProvider>
        <DashboardModeProvider initialMode={initialMode} canEdit={canEdit}>
          <FormProvider {...form}>
            <Form {...form}>
              <DashboardAutosaveBoundary
                form={form}
                experimentId={experimentId}
                dashboardId={dashboardId}
                enabled={canEdit}
              >
                <DashboardLayoutContent experimentId={experimentId} dashboard={dashboard}>
                  {children}
                </DashboardLayoutContent>
              </DashboardAutosaveBoundary>
            </Form>
          </FormProvider>
        </DashboardModeProvider>
      </DashboardEditorProvider>
    </AutosaveStatusProvider>
  );
}
