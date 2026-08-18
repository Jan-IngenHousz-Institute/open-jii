import { DeviceGroupContent } from "@/components/iot-devices/groups/device-group-content";
import { buildDeviceGroupMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ locale: string; groupId: string }>;
}

export function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, groupId } = await params;
    return buildDeviceGroupMetadata({ locale, groupId });
  });
}

export default function DeviceGroupPage() {
  return <DeviceGroupContent />;
}
