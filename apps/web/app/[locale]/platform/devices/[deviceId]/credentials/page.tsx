import { buildDeviceMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import DeviceCredentialsContent from "./device-credentials-content";

interface DeviceCredentialsPageProps {
  params: Promise<{ locale: string; deviceId: string }>;
}

export function generateMetadata({ params }: DeviceCredentialsPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, deviceId } = await params;
    return buildDeviceMetadata({ locale, deviceId, section: "credentials" });
  });
}

export default function DeviceCredentialsPage({ params }: DeviceCredentialsPageProps) {
  return <DeviceCredentialsContent params={params} />;
}
