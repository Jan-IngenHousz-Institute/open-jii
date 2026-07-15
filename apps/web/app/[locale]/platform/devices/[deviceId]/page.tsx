import { IotDeviceDetail } from "@/components/iot-devices/iot-device-detail";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Device",
};

export default async function DeviceDetailPage({
  params,
}: {
  params: Promise<{ deviceId: string }>;
}) {
  const { deviceId } = await params;
  return <IotDeviceDetail deviceId={deviceId} />;
}
