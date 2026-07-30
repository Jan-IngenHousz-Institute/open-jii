import { buildExperimentMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import VisualizationsListContent from "./visualizations-list-content";

interface VisualizationsPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export function generateMetadata({ params }: VisualizationsPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id } = await params;
    return buildExperimentMetadata({ locale, id, section: "visualizations" });
  });
}

export default function VisualizationsPage() {
  return <VisualizationsListContent />;
}
