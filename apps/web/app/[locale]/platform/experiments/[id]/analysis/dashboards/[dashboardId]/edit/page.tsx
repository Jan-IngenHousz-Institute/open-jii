"use client";

import { DashboardEditor } from "@/components/experiment-dashboards/editor/dashboard-editor";
import { useParams } from "next/navigation";

export default function DashboardEditorPage() {
  const { id: experimentId, dashboardId } = useParams<{
    id: string;
    dashboardId: string;
  }>();

  return <DashboardEditor experimentId={experimentId} dashboardId={dashboardId} />;
}
