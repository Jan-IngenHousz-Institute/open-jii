import type { DeviceCommandExecutor } from "~/features/connection/services/device-command-executor";
import { delay } from "~/features/connection/utils/delay";

// Device id whose scans always fail; lets the multi-scan partial-failure UI
// be demoed without unplugging hardware mid-measurement.
export const FAILING_MOCK_DEVICE_ID = "3";

export function createMockCommandExecutor(deviceId: string): DeviceCommandExecutor {
  let cancelled = false;
  return {
    async execute(_command: string | object) {
      cancelled = false;
      await delay(1200 + Math.random() * 800);

      if (cancelled) {
        throw new Error("Measurement cancelled");
      }
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
    cancel() {
      cancelled = true;
      return Promise.resolve();
    },
    getIdentity() {
      return Promise.resolve({
        family: "multispeq" as const,
        name: `Mock MultispeQ ${deviceId}`,
        deviceId: `mock-${deviceId}`,
        firmwareVersion: "2.311-mock",
        batteryPercent: 80 + parseInt(deviceId, 10),
        raw: {},
      });
    },
    onProgress() {
      return () => undefined;
    },
    destroy() {
      return Promise.resolve();
    },
  };
}
