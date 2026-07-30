import { buildDeviceMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import DeviceOverviewContent from "./device-overview-content";

interface DeviceOverviewPageProps {
  params: Promise<{ locale: string; deviceId: string }>;
}

export function generateMetadata({ params }: DeviceOverviewPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, deviceId } = await params;
    return buildDeviceMetadata({ locale, deviceId });
  });
}

export default function DeviceOverviewPage({ params }: DeviceOverviewPageProps) {
  return <DeviceOverviewContent params={params} />;
}
