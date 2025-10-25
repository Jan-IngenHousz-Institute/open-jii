import { redirect } from "next/navigation";

interface NewVisualizationRedirectPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function NewVisualizationRedirectPage({
  params,
}: NewVisualizationRedirectPageProps) {
  const { locale, id } = await params;
  // Redirect to the new analysis/visualizations/new location
  redirect(`/${locale}/platform/experiments/${id}/analysis/visualizations/new`);
}
