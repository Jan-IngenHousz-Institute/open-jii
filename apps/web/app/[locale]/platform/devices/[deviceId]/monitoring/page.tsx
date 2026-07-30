import { buildDeviceMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import DeviceMonitoringContent from "./device-monitoring-content";

interface DeviceMonitoringPageProps {
  params: Promise<{ locale: string; deviceId: string }>;
}

export function generateMetadata({ params }: DeviceMonitoringPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, deviceId } = await params;
    return buildDeviceMetadata({ locale, deviceId, section: "monitoring" });
  });
}

export default function DeviceMonitoringPage() {
  return <DeviceMonitoringContent />;
}
