import ExperimentVisualizationReadOnly from "@/features/experiment-visualizations/components/experiment-visualization-read-only";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{
    locale: string;
    id: string;
    visualizationId: string;
  }>;
}

export default async function ArchivedVisualizationDetailPage({ params }: PageProps) {
  const { id: experimentId, visualizationId } = await params;

  if (!experimentId || !visualizationId) {
    notFound();
  }

  return (
    <ExperimentVisualizationReadOnly
      experimentId={experimentId}
      visualizationId={visualizationId}
    />
  );
}
