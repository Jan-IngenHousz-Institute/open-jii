import { buildExperimentMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import ArchivedExperimentDesignContent from "./archived-experiment-design-content";

interface ArchivedExperimentDesignPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export function generateMetadata({ params }: ArchivedExperimentDesignPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id } = await params;
    return buildExperimentMetadata({ locale, id, section: "design", archived: true });
  });
}

export default function ArchivedExperimentDesignPage({
  params,
}: ArchivedExperimentDesignPageProps) {
  return <ArchivedExperimentDesignContent params={params} />;
}
