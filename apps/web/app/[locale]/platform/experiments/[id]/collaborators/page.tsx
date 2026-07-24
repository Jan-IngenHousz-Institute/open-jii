import { buildExperimentMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import ExperimentCollaboratorsContent from "./experiment-collaborators-content";

interface ExperimentCollaboratorsPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export function generateMetadata({ params }: ExperimentCollaboratorsPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id } = await params;
    return buildExperimentMetadata({ locale, id, section: "collaborators" });
  });
}

export default function ExperimentCollaboratorsPage({ params }: ExperimentCollaboratorsPageProps) {
  return <ExperimentCollaboratorsContent params={params} />;
}
