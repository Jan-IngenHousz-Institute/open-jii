"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { DashboardFormValues } from "./dashboard-form-shell";
import { GridBackdrop } from "./editor/canvas/grid-backdrop";
import { WidgetPlacementGhost } from "./editor/canvas/widget-placement-ghost";
import { useDashboardEditor } from "./editor/context/dashboard-editor-context";
import { LiveVizProvider } from "./editor/context/live-viz-context";
import { DashboardModebar } from "./editor/dashboard-modebar";
import { useBackdropBounds } from "./editor/hooks/use-backdrop-bounds";

// Client-only: inspector strips drag-import Plotly via the viz config.
// The modebar has no Plotly chain so it stays a static import.
const DashboardToolbar = dynamic(() => import("./editor/dashboard-toolbar"), {
  ssr: false,
});

export interface DashboardGradientBodyProps {
  experimentId: string;
  isEditing: boolean;
  children: React.ReactNode;
}

export function DashboardGradientBody({
  experimentId,
  isEditing,
  children,
}: DashboardGradientBodyProps) {
  const gradientRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const bounds = useBackdropBounds(gradientRef, canvasRef);

  const form = useFormContext<DashboardFormValues>();
  const layout = useWatch({ control: form.control, name: "layout" });
  const { selectedWidgetId } = useDashboardEditor();

  // Conditionally mount only the active chrome — keeping both mounted (the
  // previous design) caused the inactive sticky pill to perturb Chrome's
  // overflow/scroll calculation, leaving a white strip below the gradient.
  const modebarVisible = isEditing && selectedWidgetId === null;
  const toolbarVisible = isEditing && selectedWidgetId !== null;

  return (
    // LiveVizProvider wraps both the canvas (consumer via LoadedVisualizationView)
    // and the toolbar (publisher via useLiveVizPreview in VisualizationStripsHost).
    // Mounting it deeper disconnects the live channel.
    <LiveVizProvider>
      <div
        ref={gradientRef}
        className="relative -mx-6 -mb-6 flex-1 overflow-x-clip border-t border-[#EDF2F6] px-6 pb-6"
        style={{ background: "linear-gradient(270.03deg, #F5FFF8 0%, #F4F9FF 100%)" }}
      >
        {isEditing && bounds && <GridBackdrop bounds={bounds} layout={layout} />}
        <div className="relative mx-auto w-full max-w-7xl pt-6">
          <div ref={canvasRef} className="relative min-w-0">
            {children}
          </div>
          {modebarVisible && <DashboardModebar visible={true} />}
          {toolbarVisible && (
            <DashboardToolbar visible={true} experimentId={experimentId} />
          )}
          <WidgetPlacementGhost />
        </div>
      </div>
    </LiveVizProvider>
  );
}
