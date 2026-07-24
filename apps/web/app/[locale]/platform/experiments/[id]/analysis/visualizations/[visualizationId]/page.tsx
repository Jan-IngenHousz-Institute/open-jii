import { VisualizationWorkspace } from "@/components/experiment-visualizations/workspace/visualization-workspace";
import { buildVisualizationMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

interface VisualizationEditorPageProps {
  params: Promise<{ locale: string; id: string; visualizationId: string }>;
}

export function generateMetadata({ params }: VisualizationEditorPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id, visualizationId } = await params;
    return buildVisualizationMetadata({ locale, experimentId: id, visualizationId });
  });
}

export default async function VisualizationEditorPage({ params }: VisualizationEditorPageProps) {
  const { id: experimentId, visualizationId } = await params;

  return <VisualizationWorkspace experimentId={experimentId} visualizationId={visualizationId} />;
}
