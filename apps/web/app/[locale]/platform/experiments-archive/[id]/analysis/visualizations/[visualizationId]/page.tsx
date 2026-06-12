import ExperimentVisualizationReadOnly from "@/components/experiment-visualizations/experiment-visualization-read-only";
import { PageContainer } from "@/components/page-container";
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
    <PageContainer width="fluid">
      <ExperimentVisualizationReadOnly
        experimentId={experimentId}
        visualizationId={visualizationId}
      />
    </PageContainer>
  );
}
