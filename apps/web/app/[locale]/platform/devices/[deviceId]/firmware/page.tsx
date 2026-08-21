import DeviceFirmwareContent from "@/components/iot-devices/firmware/device-firmware-content";
import { buildDeviceMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

interface DeviceFirmwarePageProps {
  params: Promise<{ locale: string; deviceId: string }>;
}

export function generateMetadata({ params }: DeviceFirmwarePageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, deviceId } = await params;
    return buildDeviceMetadata({ locale, deviceId, section: "firmware" });
  });
}

export default function DeviceFirmwarePage() {
  return <DeviceFirmwareContent />;
}
