import { redirect } from "next/navigation";

interface AnalysisPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const { locale, id } = await params;
  redirect(`/${locale}/platform/experiments/${id}/analysis/visualizations`);
}
