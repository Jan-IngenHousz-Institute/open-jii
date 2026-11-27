"use client";

import { usePrincipalSession } from "@/components/auth/principal-context";
import type { ReactNode } from "react";

import type {
  ExperimentDashboard,
  ExperimentDashboardLayout,
  ExperimentDashboardWidget,
} from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";

import { DashboardFormGate } from "./dashboard-form-gate";

export interface DashboardFormValues {
  name: string;
  description?: string;
  layout: ExperimentDashboardLayout;
  widgets: ExperimentDashboardWidget[];
}

export interface DashboardFormShellProps {
  experimentId: string;
  dashboardId: string;
  dashboard?: ExperimentDashboard;
  isLoading?: boolean;
  error?: unknown;
  initialMode: "view" | "edit";
  children: ReactNode;
}

export function DashboardFormShell(props: DashboardFormShellProps) {
  const { experimentId, dashboardId } = props;
  const { userId, sessionId } = usePrincipalSession();
  return (
    <DashboardFormGate
      key={JSON.stringify([experimentId, dashboardId, userId, sessionId])}
      {...props}
    />
  );
}
