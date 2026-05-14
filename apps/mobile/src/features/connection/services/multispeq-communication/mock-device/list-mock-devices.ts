import { delay } from "~/utils/delay";

export async function listMockDevices() {
  await delay(300);
  return [
    { id: "1", name: "MultispeQ Dummy 1" },
    { id: "2", name: "MultispeQ Dummy 2" },
    { id: "3", name: "MultispeQ Dummy 3" },
  ];
}
