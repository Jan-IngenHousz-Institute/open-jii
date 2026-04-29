import { notFound } from "next/navigation";

import ExperimentVisualizationReadOnly from "../../../../../../../../components/experiment-visualizations/experiment-visualization-read-only";

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
