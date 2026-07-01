"use client";

import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { ExperimentDashboard } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";

import type { DashboardFormValues } from "./dashboard-form-shell";
import { DashboardRenderer } from "./dashboard-renderer";

export interface DashboardViewBodyProps {
  experimentId: string;
  dashboardId: string;
}

export function DashboardViewBody({ experimentId, dashboardId }: DashboardViewBodyProps) {
  const form = useFormContext<DashboardFormValues>();
  const name = useWatch({ control: form.control, name: "name" });
  const description = useWatch({ control: form.control, name: "description" });
  const layout = useWatch({ control: form.control, name: "layout" });
  const widgets = useWatch({ control: form.control, name: "widgets" });

  const dashboard = useMemo<ExperimentDashboard>(
    () => ({
      id: dashboardId,
      experimentId,
      name,
      description: description ?? null,
      layout,
      widgets,
      createdBy: "",
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    }),
    [dashboardId, experimentId, name, description, layout, widgets],
  );

  return <DashboardRenderer dashboard={dashboard} experimentId={experimentId} />;
}
