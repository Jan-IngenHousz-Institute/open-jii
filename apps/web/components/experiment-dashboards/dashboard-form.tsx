"use client";

import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { canDuplicateExperimentChart } from "@/util/can-duplicate-experiment-chart";
import { useMemo } from "react";
import { FormProvider, useForm } from "react-hook-form";

import type { ExperimentDashboard } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import { Form } from "@repo/ui/components/form";

import { AutosaveStatusProvider } from "../shared/autosave/autosave-status-context";
import type { DashboardFormShellProps, DashboardFormValues } from "./dashboard-form-shell";
import { DashboardLayoutContent } from "./dashboard-layout-content";
import { DashboardModeProvider } from "./dashboard-mode-context";
import { DashboardEditorProvider } from "./editor/context/dashboard-editor-context";
import { DashboardAutosaveBoundary } from "./editor/dashboard-autosave-boundary";

export function DashboardForm({
  experimentId,
  dashboardId,
  dashboard,
  initialDashboard = dashboard,
  initialMode,
  children,
}: DashboardFormShellProps & {
  dashboard: ExperimentDashboard;
  initialDashboard?: ExperimentDashboard;
}) {
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
