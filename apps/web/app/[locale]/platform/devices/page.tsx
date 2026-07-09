import { IotDevicesView } from "@/components/iot-devices/iot-devices-view";
import { PageContainer } from "@/components/page-container";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IotDevices",
};

export default function IotDevicesPage() {
  return (
    <PageContainer width="fluid" className="space-y-6">
      <IotDevicesView />
    </PageContainer>
  );
}
