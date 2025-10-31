import { redirect } from "next/navigation";

interface VisualizationDetailRedirectPageProps {
  params: Promise<{
    locale: string;
    id: string;
    visualizationId: string;
  }>;
}

export default async function VisualizationDetailRedirectPage({
  params,
}: VisualizationDetailRedirectPageProps) {
  const { locale, id, visualizationId } = await params;
  // Redirect to the new analysis/visualizations/[id] location
  redirect(`/${locale}/platform/experiments/${id}/analysis/visualizations/${visualizationId}`);
}
