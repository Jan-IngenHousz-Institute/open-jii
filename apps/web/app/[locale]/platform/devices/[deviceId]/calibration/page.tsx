import DeviceCalibrationContent from "@/components/iot-devices/calibration/device-calibration-content";
import { buildDeviceMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

interface DeviceCalibrationPageProps {
  params: Promise<{ locale: string; deviceId: string }>;
}

export function generateMetadata({ params }: DeviceCalibrationPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, deviceId } = await params;
    return buildDeviceMetadata({ locale, deviceId, section: "calibration" });
  });
}

export default function DeviceCalibrationPage() {
  return <DeviceCalibrationContent />;
}
