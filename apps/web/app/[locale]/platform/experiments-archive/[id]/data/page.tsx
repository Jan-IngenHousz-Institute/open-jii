import { buildExperimentMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import ArchivedExperimentDataContent from "./archived-experiment-data-content";

interface ArchivedExperimentDataPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export function generateMetadata({ params }: ArchivedExperimentDataPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id } = await params;
    return buildExperimentMetadata({ locale, id, section: "data", archived: true });
  });
}

export default function ArchivedExperimentDataPage({ params }: ArchivedExperimentDataPageProps) {
  return <ArchivedExperimentDataContent params={params} />;
}
