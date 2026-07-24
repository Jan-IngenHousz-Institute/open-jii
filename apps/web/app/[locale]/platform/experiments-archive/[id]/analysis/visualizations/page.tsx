import { buildExperimentMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import ArchivedVisualizationsListContent from "./archived-visualizations-list-content";

interface ArchivedVisualizationsPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export function generateMetadata({ params }: ArchivedVisualizationsPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id } = await params;
    return buildExperimentMetadata({ locale, id, section: "visualizations", archived: true });
  });
}

export default function ArchivedVisualizationsPage() {
  return <ArchivedVisualizationsListContent />;
}
