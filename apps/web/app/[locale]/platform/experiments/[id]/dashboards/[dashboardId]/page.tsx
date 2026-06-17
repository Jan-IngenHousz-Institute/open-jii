"use client";

import { useDashboardMode } from "@/components/experiment-dashboards/dashboard-mode-context";
import { DashboardViewBody } from "@/components/experiment-dashboards/dashboard-view-body";
import { DashboardEditorBody } from "@/components/experiment-dashboards/editor/dashboard-editor-body";
import { useParams } from "next/navigation";

export default function DashboardPage() {
  const { id: experimentId, dashboardId } = useParams<{ id: string; dashboardId: string }>();
  const { mode } = useDashboardMode();

  return mode === "edit" ? (
    <DashboardEditorBody experimentId={experimentId} />
  ) : (
    <DashboardViewBody experimentId={experimentId} dashboardId={dashboardId} />
  );
}
