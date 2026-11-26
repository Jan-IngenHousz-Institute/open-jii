"use client";

import { DashboardFormShell } from "@/components/experiment-dashboards/dashboard-form-shell";
import { useExperimentDashboard } from "@/hooks/experiment/useExperimentDashboard/useExperimentDashboard";
import { useParams, useSearchParams } from "next/navigation";

interface LayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: LayoutProps) {
  const { id: experimentId, dashboardId } = useParams<{ id: string; dashboardId: string }>();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("edit") === "1" ? "edit" : "view";

  const { data, isLoading, error } = useExperimentDashboard(dashboardId, experimentId);

  return (
    <div className="page-fluid flex flex-1 flex-col">
      <DashboardFormShell
        experimentId={experimentId}
        dashboardId={dashboardId}
        dashboard={data}
        isLoading={isLoading}
        error={error}
        initialMode={initialMode}
      >
        {children}
      </DashboardFormShell>
    </div>
  );
}
