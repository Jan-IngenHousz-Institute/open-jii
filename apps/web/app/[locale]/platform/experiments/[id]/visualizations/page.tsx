import { redirect } from "next/navigation";

interface VisualizationsRedirectPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function VisualizationsRedirectPage({
  params,
}: VisualizationsRedirectPageProps) {
  const { locale, id } = await params;
  // Redirect to the new analysis/visualizations location
  redirect(`/${locale}/platform/experiments/${id}/analysis/visualizations`);
}
