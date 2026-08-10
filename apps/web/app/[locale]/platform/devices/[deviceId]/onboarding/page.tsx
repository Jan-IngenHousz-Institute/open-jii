import { buildDeviceMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import DeviceOnboardingContent from "./device-onboarding-content";

interface DeviceOnboardingPageProps {
  params: Promise<{ locale: string; deviceId: string }>;
}

export function generateMetadata({ params }: DeviceOnboardingPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, deviceId } = await params;
    return buildDeviceMetadata({ locale, deviceId, section: "onboarding" });
  });
}

export default function DeviceOnboardingPage() {
  return <DeviceOnboardingContent />;
}
