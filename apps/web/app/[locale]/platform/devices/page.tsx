import { IotDevicesOverview } from "@/components/iot-devices/iot-devices-overview";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Devices",
};

export default function DevicesPage() {
  return <IotDevicesOverview />;
}
