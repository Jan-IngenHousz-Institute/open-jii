import { buildExperimentMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import ExperimentOverviewContent from "./experiment-overview-content";

interface ExperimentOverviewPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export function generateMetadata({ params }: ExperimentOverviewPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id } = await params;
    return buildExperimentMetadata({ locale, id, section: "overview" });
  });
}

export default function ExperimentOverviewPage({ params }: ExperimentOverviewPageProps) {
  return <ExperimentOverviewContent params={params} />;
}
