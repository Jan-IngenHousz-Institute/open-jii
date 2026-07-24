import { buildExperimentMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import DashboardsListContent from "./dashboards-list-content";

interface DashboardsPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export function generateMetadata({ params }: DashboardsPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id } = await params;
    return buildExperimentMetadata({ locale, id, section: "dashboards" });
  });
}

export default function DashboardsPage() {
  return <DashboardsListContent />;
}
