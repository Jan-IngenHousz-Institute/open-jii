import { DevicesSectionTabs } from "@/components/iot-devices/devices-section-tabs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Devices",
};

export default function DevicesPage() {
  return <DevicesSectionTabs />;
}
