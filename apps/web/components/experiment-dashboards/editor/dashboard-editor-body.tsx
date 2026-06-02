"use client";

import { DashboardCanvas } from "./canvas/dashboard-canvas";

export interface DashboardEditorBodyProps {
  experimentId: string;
}

export function DashboardEditorBody({ experimentId }: DashboardEditorBodyProps) {
  return (
    <div className="relative min-h-[calc(100vh-20rem)]">
      <DashboardCanvas experimentId={experimentId} />
    </div>
  );
}
