import { IotDevicesTableView } from "@/components/iot-devices/iot-devices-table-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Devices",
};

export default function DevicesAllPage() {
  return <IotDevicesTableView />;
}
