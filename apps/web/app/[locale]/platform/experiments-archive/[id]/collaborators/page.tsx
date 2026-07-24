import { buildExperimentMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import ArchivedExperimentCollaboratorsContent from "./archived-experiment-collaborators-content";

interface ArchivedExperimentCollaboratorsPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export function generateMetadata({
  params,
}: ArchivedExperimentCollaboratorsPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id } = await params;
    return buildExperimentMetadata({ locale, id, section: "collaborators", archived: true });
  });
}

export default function ArchivedExperimentCollaboratorsPage({
  params,
}: ArchivedExperimentCollaboratorsPageProps) {
  return <ArchivedExperimentCollaboratorsContent params={params} />;
}
