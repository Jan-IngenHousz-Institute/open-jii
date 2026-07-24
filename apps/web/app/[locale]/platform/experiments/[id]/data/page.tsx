import { buildExperimentMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import ExperimentDataContent from "./experiment-data-content";

interface ExperimentDataPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export function generateMetadata({ params }: ExperimentDataPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id } = await params;
    return buildExperimentMetadata({ locale, id, section: "data" });
  });
}

export default function ExperimentDataPage({ params }: ExperimentDataPageProps) {
  return <ExperimentDataContent params={params} />;
}
