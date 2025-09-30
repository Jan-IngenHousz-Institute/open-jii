import { notFound } from "next/navigation";

import ExperimentVisualizationDetailPage from "../../../../../../../components/experiment-visualizations/experiment-visualization-detail-page";

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
    <ExperimentVisualizationDetailPage
      experimentId={experimentId}
      visualizationId={visualizationId}
    />
  );
}
