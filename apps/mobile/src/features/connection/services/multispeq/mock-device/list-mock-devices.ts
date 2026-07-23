import { delay } from "~/features/connection/utils/delay";
import type { Device } from "~/shared/types/device";

export async function listMockDevices(): Promise<Device[]> {
  await delay(300);
  return [
    { id: "1", type: "mock-device", name: "MultispeQ Dummy 1" },
    { id: "2", type: "mock-device", name: "MultispeQ Dummy 2" },
    { id: "3", type: "mock-device", name: "MultispeQ Dummy 3" },
  ];
}
