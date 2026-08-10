import { buildDeviceMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import DeviceCollaboratorsContent from "./device-collaborators-content";

interface DeviceCollaboratorsPageProps {
  params: Promise<{ locale: string; deviceId: string }>;
}

export function generateMetadata({ params }: DeviceCollaboratorsPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, deviceId } = await params;
    return buildDeviceMetadata({ locale, deviceId, section: "collaborators" });
  });
}

export default function DeviceCollaboratorsPage({ params }: DeviceCollaboratorsPageProps) {
  return <DeviceCollaboratorsContent params={params} />;
}
