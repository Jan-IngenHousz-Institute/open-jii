"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import { FormProvider, useForm } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";

import type {
  DashboardLayout,
  DashboardWidget,
  ExperimentDashboard,
} from "@repo/api/schemas/experiment.schema";
import { Form } from "@repo/ui/components/form";

import { AutosaveStatusProvider } from "../shared/autosave/autosave-status-context";
import { DashboardLayoutContent } from "./dashboard-layout-content";
import { DashboardModeProvider } from "./dashboard-mode-context";
import { DashboardEditorProvider } from "./editor/context/dashboard-editor-context";
import { useDashboardAutosave } from "./editor/hooks/use-dashboard-autosave";

export interface DashboardFormValues {
  name: string;
  description?: string;
  layout: DashboardLayout;
  widgets: DashboardWidget[];
}

export interface DashboardFormShellProps {
  experimentId: string;
  dashboardId: string;
  dashboard: ExperimentDashboard;
  initialMode: "view" | "edit";
  children: ReactNode;
}

export function DashboardFormShell({
  experimentId,
  dashboardId,
  dashboard,
  initialMode,
  children,
}: DashboardFormShellProps) {
  const defaults = useMemo<DashboardFormValues>(
    () => ({
      name: dashboard.name,
      description: dashboard.description ?? "",
      layout: dashboard.layout,
      widgets: dashboard.widgets,
    }),
    [dashboard],
  );

  const form = useForm<DashboardFormValues>({ defaultValues: defaults });

  return (
    <AutosaveStatusProvider>
      <DashboardEditorProvider>
        <DashboardModeProvider initialMode={initialMode}>
          <FormProvider {...form}>
            <Form {...form}>
              <DashboardFormShellBody
                form={form}
                experimentId={experimentId}
                dashboardId={dashboardId}
                dashboard={dashboard}
              >
                {children}
              </DashboardFormShellBody>
            </Form>
          </FormProvider>
        </DashboardModeProvider>
      </DashboardEditorProvider>
    </AutosaveStatusProvider>
  );
}

interface DashboardFormShellBodyProps {
  form: UseFormReturn<DashboardFormValues>;
  experimentId: string;
  dashboardId: string;
  dashboard: ExperimentDashboard;
  children: ReactNode;
}

function DashboardFormShellBody({
  form,
  experimentId,
  dashboardId,
  dashboard,
  children,
}: DashboardFormShellBodyProps) {
  useDashboardAutosave({ form, experimentId, dashboardId });
  return (
    <DashboardLayoutContent experimentId={experimentId} dashboard={dashboard}>
      {children}
    </DashboardLayoutContent>
  );
}
