import { buildExperimentMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import ArchivedExperimentOverviewContent from "./archived-experiment-overview-content";

interface ArchivedExperimentOverviewPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export function generateMetadata({
  params,
}: ArchivedExperimentOverviewPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id } = await params;
    return buildExperimentMetadata({ locale, id, section: "overview", archived: true });
  });
}

export default function ArchivedExperimentOverviewPage({
  params,
}: ArchivedExperimentOverviewPageProps) {
  return <ArchivedExperimentOverviewContent params={params} />;
}
