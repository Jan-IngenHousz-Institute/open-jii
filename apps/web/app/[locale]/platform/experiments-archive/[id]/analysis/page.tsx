import { redirect } from "next/navigation";

interface AnalysisPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const { locale, id } = await params;
  // Redirect to visualizations as the default analysis page
  redirect(`/${locale}/platform/experiments-archive/${id}/analysis/visualizations`);
}
