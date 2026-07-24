import { buildExperimentMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import ExperimentDesignContent from "./experiment-design-content";

interface ExperimentDesignPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export function generateMetadata({ params }: ExperimentDesignPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id } = await params;
    return buildExperimentMetadata({ locale, id, section: "design" });
  });
}

export default function ExperimentDesignPage({ params }: ExperimentDesignPageProps) {
  return <ExperimentDesignContent params={params} />;
}
