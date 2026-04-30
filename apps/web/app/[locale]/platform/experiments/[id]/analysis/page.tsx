import { redirect } from "next/navigation";

interface AnalysisPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const { locale, id } = await params;
  // Dashboards are now the headline Analysis surface. Standalone
  // visualizations remain available via the Visualizations sub-tab.
  redirect(`/${locale}/platform/experiments/${id}/analysis/dashboards`);
}
