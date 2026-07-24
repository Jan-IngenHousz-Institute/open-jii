import { IotDeviceDetail } from "@/components/iot-devices/iot-device-detail";
import { buildDeviceMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

interface DeviceDetailPageProps {
  params: Promise<{ locale: string; deviceId: string }>;
}

export function generateMetadata({ params }: DeviceDetailPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, deviceId } = await params;
    return buildDeviceMetadata({ locale, deviceId });
  });
}

export default async function DeviceDetailPage({ params }: DeviceDetailPageProps) {
  const { deviceId } = await params;
  return <IotDeviceDetail deviceId={deviceId} />;
}
