import { notFound } from "next/navigation";

import ExperimentVisualizationDetails from "../../../../../../../../components/experiment-visualizations/experiment-visualization-details";

interface PageProps {
  params: Promise<{
    locale: string;
    id: string;
    visualizationId: string;
  }>;
}

export default async function VisualizationDetailPage({ params }: PageProps) {
  const { id: experimentId, visualizationId } = await params;

  if (!experimentId || !visualizationId) {
    notFound();
  }

  return (
    <ExperimentVisualizationDetails
      experimentId={experimentId}
      visualizationId={visualizationId}
      isArchiveContext={true}
    />
  );
}
