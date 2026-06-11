"use client";

import { VisualizationWorkspace } from "@/features/experiment-visualizations/components/workspace/visualization-workspace";
import { useParams } from "next/navigation";

export default function VisualizationEditorPage() {
  const { id: experimentId, visualizationId } = useParams<{
    id: string;
    visualizationId: string;
  }>();

  return <VisualizationWorkspace experimentId={experimentId} visualizationId={visualizationId} />;
}
