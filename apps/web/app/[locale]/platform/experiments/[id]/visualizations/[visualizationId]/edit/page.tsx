import { redirect } from "next/navigation";

interface EditVisualizationRedirectPageProps {
  params: Promise<{
    locale: string;
    id: string;
    visualizationId: string;
  }>;
}

export default async function EditVisualizationRedirectPage({
  params,
}: EditVisualizationRedirectPageProps) {
  const { locale, id, visualizationId } = await params;
  // Redirect to the new analysis/visualizations/[id]/edit location
  redirect(`/${locale}/platform/experiments/${id}/analysis/visualizations/${visualizationId}/edit`);
}
