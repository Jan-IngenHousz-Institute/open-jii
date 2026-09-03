import { GroupMonitoringContent } from "@/components/iot-devices/groups/group-monitoring-content";
import { buildDeviceGroupMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ locale: string; groupId: string }>;
}

export function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, groupId } = await params;
    return buildDeviceGroupMetadata({ locale, groupId, section: "monitoring" });
  });
}

export default function DeviceGroupMonitoringPage() {
  return <GroupMonitoringContent />;
}
