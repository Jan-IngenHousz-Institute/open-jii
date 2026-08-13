import { buildExperimentMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import ExperimentDevicesContent from "./experiment-devices-content";

interface ExperimentDevicesPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export function generateMetadata({ params }: ExperimentDevicesPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id } = await params;
    return buildExperimentMetadata({ locale, id, section: "devices" });
  });
}

export default function ExperimentDevicesPage({ params }: ExperimentDevicesPageProps) {
  return <ExperimentDevicesContent params={params} />;
}
