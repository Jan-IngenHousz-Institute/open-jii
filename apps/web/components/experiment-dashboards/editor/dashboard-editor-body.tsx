"use client";

import { DashboardCanvas } from "./canvas/dashboard-canvas";

export interface DashboardEditorBodyProps {
  experimentId: string;
}

export function DashboardEditorBody({ experimentId }: DashboardEditorBodyProps) {
  // LiveVizProvider lives at `DashboardGradientBody` so the toolbar
  // (sibling of the canvas in the gradient body) can publish into the
  // same context the canvas reads from.
  return (
    <div className="relative min-h-[calc(100vh-20rem)]">
      <DashboardCanvas experimentId={experimentId} />
    </div>
  );
}
