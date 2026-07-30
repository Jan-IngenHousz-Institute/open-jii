import { buildDeviceMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import DeviceLineageContent from "./device-lineage-content";

interface DeviceLineagePageProps {
  params: Promise<{ locale: string; deviceId: string }>;
}

export function generateMetadata({ params }: DeviceLineagePageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, deviceId } = await params;
    return buildDeviceMetadata({ locale, deviceId, section: "lineage" });
  });
}

export default function DeviceLineagePage() {
  return <DeviceLineageContent />;
}
