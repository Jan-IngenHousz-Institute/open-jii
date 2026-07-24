import { buildDashboardMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import DashboardDetailContent from "./dashboard-detail-content";

interface DashboardPageProps {
  params: Promise<{ locale: string; id: string; dashboardId: string }>;
}

export function generateMetadata({ params }: DashboardPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id, dashboardId } = await params;
    return buildDashboardMetadata({ locale, experimentId: id, dashboardId });
  });
}

export default function DashboardPage() {
  return <DashboardDetailContent />;
}
