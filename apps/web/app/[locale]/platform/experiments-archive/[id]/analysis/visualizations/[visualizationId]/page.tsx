import ExperimentVisualizationReadOnly from "@/components/experiment-visualizations/experiment-visualization-read-only";
import { PageContainer } from "@/components/page-container";
import { buildVisualizationMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{
    locale: string;
    id: string;
    visualizationId: string;
  }>;
}

export function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id, visualizationId } = await params;
    return buildVisualizationMetadata({
      locale,
      experimentId: id,
      visualizationId,
      archived: true,
    });
  });
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
