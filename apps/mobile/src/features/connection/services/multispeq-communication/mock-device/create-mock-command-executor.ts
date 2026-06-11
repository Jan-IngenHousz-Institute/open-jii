import type { IMultispeqCommandExecutor } from "~/features/connection/services/multispeq-communication/multispeq-command-executor";
import { delay } from "~/features/connection/utils/delay";

import { MULTISPEQ_CONSOLE } from "@repo/iot";

// Device id whose scans always fail — lets the multi-scan partial-failure UI
// be demoed without unplugging hardware mid-measurement.
export const FAILING_MOCK_DEVICE_ID = "3";

export function createMockCommandExecutor(deviceId: string): IMultispeqCommandExecutor {
  return {
    async execute(command: string | object) {
      if (command === MULTISPEQ_CONSOLE.CANCEL) {
        return { status: "cancelled" };
      }

      await delay(1200 + Math.random() * 800);

      if (deviceId === FAILING_MOCK_DEVICE_ID) {
        throw new Error("Mock device failure (simulated)");
      }

      return {
        device_id: `mock-${deviceId}`,
        device_battery: 80 + parseInt(deviceId, 10),
        sample: [
          {
            protocol_id: "mock",
            data_raw: Array.from({ length: 16 }, () => Math.round(Math.random() * 4096)),
          },
        ],
      };
    },
    destroy() {
      return Promise.resolve();
    },
  };
}
